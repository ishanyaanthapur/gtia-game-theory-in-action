"""Deterministic game state machine for Dilemma Detectives. No LLM calls in this file.

Every number the player sees (sentences, matrix values, right/wrong) comes from here, so no
prompt can talk the game into a different outcome.
"""
from __future__ import annotations

import uuid
from dataclasses import dataclass, field

from backend.game.coverage import allowed_partner_moves, locked_player_moves
from backend.game.payoffs import ALL_CELLS, Cell, Move, sentence
from backend.models import Avatar, Award, MatrixCell, Message, Phase, RoundResult, SessionView

MAX_ROUNDS = 4
MAX_COP_MESSAGES_PER_ROUND = 3
MAX_TUTOR_QUESTIONS = 3      # questions the player may type to Nash-sensei during the challenge
MAX_CHALLENGE_ATTEMPTS = 2   # wrong dominant-strategy picks before the tutor reveals it
DOMINANT = Move.CONFESS      # the dominant strategy in this payoff matrix (for both players)

# ---- scoring (all in code; the AI never decides points) ----
CELL_POINTS = {1: 100, 2: 50, 3: 25}      # matrix cell right on attempt 1 / 2 / 3
PREDICTION_POINTS = 50                     # guessed the partner's move
DOMINANT_POINTS = {1: 200, 2: 100}         # named the dominant strategy on attempt 1 / 2
STREAK_BONUS = 10                          # +10 per answer already in the current streak

BADGES = {
    "matrix_master": "🧮 Matrix Master: all 4 cells right on the first try",
    "mind_reader": "🔮 Mind Reader: 3+ correct predictions",
    "game_theorist": "🎯 Game Theorist: found the dominant strategy first try",
    "on_fire": "🔥 On Fire: 5 right answers in a row",
    "trusting_start": "🤝 Trusting Start: stayed silent in round 1",
    "bold_opener": "😈 Bold Opener: confessed in round 1",
}
MAX_CELL_ATTEMPTS = 3  # after this many wrong answers the tutor reveals the cell
MAX_LLM_CALLS_PER_SESSION = 50


class GameError(Exception):
    """An action that isn't legal right now. `status` maps to an HTTP code."""

    def __init__(self, message: str, status: int = 409) -> None:
        super().__init__(message)
        self.message = message
        self.status = status


@dataclass
class GameSession:
    avatar: Avatar
    session_id: str = field(default_factory=lambda: uuid.uuid4().hex[:12])
    phase: Phase = Phase.INTERROGATION
    round: int = 1
    history: list[RoundResult] = field(default_factory=list)
    messages: list[Message] = field(default_factory=list)
    cop_messages_this_round: int = 0
    tutor_questions: int = 0
    challenge_attempts: int = 0
    dominant_found: bool | None = None
    score: int = 0
    streak: int = 0
    best_streak: int = 0
    last_awards: list[Award] = field(default_factory=list)
    llm_calls_used: int = 0

    # ----- derived state -----

    @property
    def visited(self) -> list[Cell]:
        return [(r.player_move, r.partner_move) for r in self.history]

    @property
    def current(self) -> RoundResult:
        if not self.history:
            raise GameError("No round has been played yet.")
        return self.history[-1]

    def locked_moves(self) -> list[Move]:
        return locked_player_moves(self.visited)

    def allowed_partner_moves(self, player_move: Move) -> list[Move]:
        return allowed_partner_moves(player_move, self.visited)

    # ----- guards -----

    def _require_phase(self, phase: Phase) -> None:
        if self.phase != phase:
            raise GameError(f"That action isn't available during the '{self.phase}' phase.")

    def use_llm_call(self) -> None:
        """Called before every agent run; stops runaway agent loops and overspending."""
        if self.llm_calls_used >= MAX_LLM_CALLS_PER_SESSION:
            raise GameError("This session has used its AI budget. Start a new game to keep playing.", status=429)
        self.llm_calls_used += 1

    # ----- scoring -----

    def _award(self, reason: str, points: int) -> None:
        """A right answer: extend the streak and add points (+ streak bonus)."""
        self.streak += 1
        self.best_streak = max(self.best_streak, self.streak)
        bonus = STREAK_BONUS * (self.streak - 1)
        self.score += points + bonus
        self.last_awards.append(Award(reason=reason + (f" (🔥 streak x{self.streak})" if bonus else ""), points=points + bonus))

    def _miss(self) -> None:
        self.streak = 0

    def badges(self) -> list[str]:
        earned = []
        answered = [r for r in self.history if r.cell_answered]
        if len(answered) == 4 and all(r.cell_attempts == 1 for r in answered):
            earned.append("matrix_master")
        if sum(bool(r.prediction_correct) for r in self.history) >= 3:
            earned.append("mind_reader")
        if self.dominant_found and self.challenge_attempts == 1:
            earned.append("game_theorist")
        if self.best_streak >= 5:
            earned.append("on_fire")
        if self.history:
            earned.append("trusting_start" if self.history[0].player_move == Move.SILENT else "bold_opener")
        return [BADGES[b] for b in earned]

    # ----- actions -----

    def register_cop_message(self) -> None:
        self._require_phase(Phase.INTERROGATION)
        if self.cop_messages_this_round >= MAX_COP_MESSAGES_PER_ROUND:
            raise GameError("Detective Zhou is done talking. Time to choose: stay silent or confess.", status=429)
        self.cop_messages_this_round += 1

    def validate_player_move(self, move: Move) -> None:
        self._require_phase(Phase.INTERROGATION)
        if self.round > MAX_ROUNDS:
            raise GameError("All four rounds are done.")
        if move in self.locked_moves():
            raise GameError(
                f"You've already explored every outcome of '{move}'. Try the other strategy.", status=422
            )

    def resolve_round(
        self,
        player_move: Move,
        partner_move: Move,
        *,
        partner_line: str = "",
        overridden: bool = False,
        prediction: Move | None = None,
    ) -> RoundResult:
        """Lock in both moves and compute the sentence. The partner move must be allowed."""
        self.validate_player_move(player_move)
        self.last_awards = []
        allowed = self.allowed_partner_moves(player_move)
        if partner_move not in allowed:
            raise GameError(f"Partner move '{partner_move}' isn't allowed here (allowed: {allowed}).", status=500)
        you, them = sentence(player_move, partner_move)
        result = RoundResult(
            round=self.round,
            player_move=player_move,
            partner_move=partner_move,
            player_years=you,
            partner_years=them,
            partner_forced=len(allowed) == 1,
            partner_overridden=overridden,
            partner_line=partner_line,
            predicted_partner=prediction,
            prediction_correct=None if prediction is None else prediction == partner_move,
        )
        if prediction is not None:
            if result.prediction_correct:
                self._award("🔮 Predicted Tung Tung Tung Sahur's move", PREDICTION_POINTS)
            else:
                self._miss()
        self.history.append(result)
        self.phase = Phase.MATRIX
        return result

    def answer_cell(self, player_years: int, partner_years: int) -> tuple[bool, bool]:
        """Check the player's matrix entry for this round's cell.

        Returns (correct, revealed). `revealed` is True when attempts ran out and we show the answer.
        """
        self._require_phase(Phase.MATRIX)
        self.last_awards = []
        r = self.current
        r.cell_attempts += 1
        correct = (player_years, partner_years) == (r.player_years, r.partner_years)
        revealed = not correct and r.cell_attempts >= MAX_CELL_ATTEMPTS
        if correct:
            self._award("🧮 Matrix cell" + (" first try!" if r.cell_attempts == 1 else ""), CELL_POINTS[r.cell_attempts])
        else:
            self._miss()
        if correct or revealed:
            r.cell_answered = True
            self._advance()
        return correct, revealed

    def _advance(self) -> None:
        if len(self.history) >= MAX_ROUNDS or set(self.visited) == set(ALL_CELLS):
            self.phase = Phase.CHALLENGE  # before the debrief, the player must name the dominant strategy
        else:
            self.round += 1
            self.cop_messages_this_round = 0
            self.phase = Phase.INTERROGATION

    def register_tutor_question(self) -> None:
        self._require_phase(Phase.CHALLENGE)
        if self.tutor_questions >= MAX_TUTOR_QUESTIONS:
            raise GameError("Nash-sensei has answered enough questions. Time to choose your dominant strategy.", status=429)
        self.tutor_questions += 1

    def answer_dominant(self, move: Move) -> tuple[bool, bool]:
        """The player names their dominant strategy. Returns (correct, revealed); either ends the challenge."""
        self._require_phase(Phase.CHALLENGE)
        self.last_awards = []
        self.challenge_attempts += 1
        correct = move == DOMINANT
        if correct:
            self._award("🎯 Found the dominant strategy", DOMINANT_POINTS[self.challenge_attempts])
        else:
            self._miss()
        revealed = not correct and self.challenge_attempts >= MAX_CHALLENGE_ATTEMPTS
        if correct or revealed:
            self.dominant_found = correct
            self.phase = Phase.COMPLETE
        return correct, revealed

    # ----- view -----

    def view(self) -> SessionView:
        answered = {(r.player_move, r.partner_move): r for r in self.history if r.cell_answered}
        matrix = []
        for cell in ALL_CELLS:
            r = answered.get(cell)
            matrix.append(
                MatrixCell(
                    player_move=cell[0],
                    partner_move=cell[1],
                    revealed=r is not None,
                    player_years=r.player_years if r else None,
                    partner_years=r.partner_years if r else None,
                )
            )
        return SessionView(
            session_id=self.session_id,
            avatar=self.avatar,
            phase=self.phase,
            round=self.round,
            max_rounds=MAX_ROUNDS,
            locked_moves=self.locked_moves(),
            cop_messages_left=MAX_COP_MESSAGES_PER_ROUND - self.cop_messages_this_round,
            tutor_questions_left=MAX_TUTOR_QUESTIONS - self.tutor_questions,
            challenge_attempts=self.challenge_attempts,
            dominant_found=self.dominant_found,
            score=self.score,
            streak=self.streak,
            best_streak=self.best_streak,
            badges=self.badges(),
            last_awards=self.last_awards,
            llm_calls_used=self.llm_calls_used,
            llm_calls_limit=MAX_LLM_CALLS_PER_SESSION,
            matrix=matrix,
            history=self.history,
            messages=self.messages,
        )


class SessionStore:
    """In-memory sessions. Fine for a local demo; a real deployment would use Redis/DB."""

    MAX_SESSIONS = 200

    def __init__(self) -> None:
        self._sessions: dict[str, GameSession] = {}

    def create(self, avatar: Avatar) -> GameSession:
        if len(self._sessions) >= self.MAX_SESSIONS:
            self._sessions.pop(next(iter(self._sessions)))  # evict oldest
        s = GameSession(avatar=avatar)
        self._sessions[s.session_id] = s
        return s

    def get(self, session_id: str) -> GameSession:
        try:
            return self._sessions[session_id]
        except KeyError:
            raise GameError("Session not found. Start a new game.", status=404) from None
