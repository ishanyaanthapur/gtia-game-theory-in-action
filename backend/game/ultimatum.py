"""Door 3: The Ultimatum. Deterministic engine (no LLM calls here).

Four rounds splitting a pot of 10,000 stolen H100s, alternating proposer: player, Tung Tung Tung
Sahur, player, Tung Tung Tung Sahur. The responder accepts (both get the split) or rejects (nobody
gets anything). Code validates every offer and computes every payout; the AI only decides.
Then a backward-induction challenge: what's the smallest offer a purely GPU-maximizing responder
should accept?
"""
from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from enum import StrEnum

from pydantic import BaseModel

from backend.game.engine import MAX_LLM_CALLS_PER_SESSION, MAX_TUTOR_QUESTIONS, GameError
from backend.models import Avatar, Message

POT = 10_000
STEP = 500
ALWAYS_ACCEPT_AT = POT // 2  # guardrail: an even (or better) split is never rejected
PROPOSERS = ["player", "tung", "player", "tung"]
MAX_ATTEMPTS = 2

# Backward-induction challenge (graded in code). Index of the correct option: 0.
CHALLENGE_QUESTION = (
    "**Backward induction time.** Start at the END of the game: if Tung Tung Tung Sahur cared ONLY about "
    "GPUs, what is the smallest offer he should accept? Ask me anything first. Just type below."
)
CHALLENGE_OPTIONS = [
    "500 GPUs, the smallest offer above zero",
    "2,500 GPUs (a quarter)",
    "5,000 GPUs (half)",
    "Nothing: he should reject every offer",
]
CHALLENGE_ANSWER = 0


class UPhase(StrEnum):
    PROPOSE = "propose"      # player sets an offer for Tung Tung Tung Sahur
    RESPOND = "respond"      # player accepts/rejects Tung Tung Tung Sahur's offer
    CHALLENGE = "challenge"  # backward-induction question
    COMPLETE = "complete"


class URound(BaseModel):
    round: int
    proposer: str                 # "player" | "tung"
    offer_to_responder: int       # GPUs offered to the responder
    accepted: bool
    player_gets: int
    tung_gets: int
    tung_line: str = ""
    overridden: bool = False      # code replaced the AI's decision (guardrail)


class UltimatumView(BaseModel):
    session_id: str
    avatar: Avatar
    phase: UPhase
    round: int                    # 1-based, current round
    max_rounds: int
    proposer: str | None          # who proposes this round
    pending_offer_to_player: int | None
    pot: int
    step: int
    player_total: int
    tung_total: int
    rounds: list[URound]
    tutor_questions_left: int
    challenge_attempts: int
    challenge_found: bool | None
    challenge_options: list[str]
    llm_calls_used: int
    llm_calls_limit: int
    messages: list[Message]


@dataclass
class UltimatumSession:
    avatar: Avatar
    session_id: str = field(default_factory=lambda: "u" + uuid.uuid4().hex[:11])
    phase: UPhase = UPhase.PROPOSE
    index: int = 0                                  # 0-based round index
    rounds: list[URound] = field(default_factory=list)
    pending_offer_to_player: int | None = None      # Tung's offer awaiting the player's answer
    messages: list[Message] = field(default_factory=list)
    llm_calls_used: int = 0
    tutor_questions: int = 0
    challenge_attempts: int = 0
    challenge_found: bool | None = None

    # ----- guards -----

    def _require(self, phase: UPhase) -> None:
        if self.phase != phase:
            raise GameError(f"That action isn't available during the '{self.phase}' phase.")

    def use_llm_call(self) -> None:
        if self.llm_calls_used >= MAX_LLM_CALLS_PER_SESSION:
            raise GameError("This session has used its AI budget. Start a new game to keep playing.", status=429)
        self.llm_calls_used += 1

    @staticmethod
    def validate_offer(amount: int) -> None:
        if not 0 <= amount <= POT or amount % STEP:
            raise GameError(f"Offers must be between 0 and {POT:,} in steps of {STEP}.", status=422)

    # ----- derived -----

    @property
    def proposer(self) -> str | None:
        return PROPOSERS[self.index] if self.index < len(PROPOSERS) else None

    @property
    def player_total(self) -> int:
        return sum(r.player_gets for r in self.rounds)

    @property
    def tung_total(self) -> int:
        return sum(r.tung_gets for r in self.rounds)

    # ----- actions -----

    def player_proposes(self, offer_to_tung: int, *, tung_accepts: bool, tung_line: str = "") -> URound:
        """Player offered `offer_to_tung`; Tung Tung Tung Sahur's decision is passed in (guardrail applied here)."""
        self._require(UPhase.PROPOSE)
        if self.proposer != "player":
            raise GameError("It's Tung Tung Tung Sahur's turn to propose.")
        self.validate_offer(offer_to_tung)
        overridden = False
        if offer_to_tung >= ALWAYS_ACCEPT_AT and not tung_accepts:
            tung_accepts, overridden = True, True
        r = URound(
            round=self.index + 1,
            proposer="player",
            offer_to_responder=offer_to_tung,
            accepted=tung_accepts,
            player_gets=POT - offer_to_tung if tung_accepts else 0,
            tung_gets=offer_to_tung if tung_accepts else 0,
            tung_line=tung_line,
            overridden=overridden,
        )
        self.rounds.append(r)
        self._advance()
        return r

    def tung_proposes(self, offer_to_player: int) -> None:
        """Record Tung Tung Tung Sahur's offer; the player must now accept or reject it."""
        self._require(UPhase.PROPOSE)
        if self.proposer != "tung":
            raise GameError("It's the player's turn to propose.")
        self.validate_offer(offer_to_player)
        self.pending_offer_to_player = offer_to_player
        self.phase = UPhase.RESPOND

    def player_responds(self, accept: bool, *, tung_line: str = "") -> URound:
        self._require(UPhase.RESPOND)
        offer = self.pending_offer_to_player
        assert offer is not None
        r = URound(
            round=self.index + 1,
            proposer="tung",
            offer_to_responder=offer,
            accepted=accept,
            player_gets=offer if accept else 0,
            tung_gets=POT - offer if accept else 0,
            tung_line=tung_line,
        )
        self.rounds.append(r)
        self.pending_offer_to_player = None
        self.phase = UPhase.PROPOSE
        self._advance()
        return r

    def _advance(self) -> None:
        self.index += 1
        self.phase = UPhase.CHALLENGE if self.index >= len(PROPOSERS) else UPhase.PROPOSE

    def register_tutor_question(self) -> None:
        self._require(UPhase.CHALLENGE)
        if self.tutor_questions >= MAX_TUTOR_QUESTIONS:
            raise GameError("Nash-sensei has answered enough questions. Time to choose.", status=429)
        self.tutor_questions += 1

    def answer_challenge(self, choice: int) -> tuple[bool, bool]:
        """Returns (correct, revealed); either ends the game."""
        self._require(UPhase.CHALLENGE)
        if not 0 <= choice < len(CHALLENGE_OPTIONS):
            raise GameError("That isn't one of the options.", status=422)
        self.challenge_attempts += 1
        correct = choice == CHALLENGE_ANSWER
        revealed = not correct and self.challenge_attempts >= MAX_ATTEMPTS
        if correct or revealed:
            self.challenge_found = correct
            self.phase = UPhase.COMPLETE
        return correct, revealed

    def history_text(self) -> str:
        """Compact history for prompts (facts come from code, not memory)."""
        if not self.rounds:
            return "No rounds yet."
        lines = []
        for r in self.rounds:
            who = "Player offered Tung Tung Tung Sahur" if r.proposer == "player" else "Tung Tung Tung Sahur offered the player"
            lines.append(
                f"Round {r.round}: {who} {r.offer_to_responder:,} of {POT:,}; "
                f"{'ACCEPTED' if r.accepted else 'REJECTED'} (player got {r.player_gets:,}, Tung Tung Tung Sahur got {r.tung_gets:,})."
            )
        return " ".join(lines)

    def view(self) -> UltimatumView:
        return UltimatumView(
            session_id=self.session_id,
            avatar=self.avatar,
            phase=self.phase,
            round=min(self.index + 1, len(PROPOSERS)),
            max_rounds=len(PROPOSERS),
            proposer=self.proposer,
            pending_offer_to_player=self.pending_offer_to_player,
            pot=POT,
            step=STEP,
            player_total=self.player_total,
            tung_total=self.tung_total,
            rounds=self.rounds,
            tutor_questions_left=MAX_TUTOR_QUESTIONS - self.tutor_questions,
            challenge_attempts=self.challenge_attempts,
            challenge_found=self.challenge_found,
            challenge_options=CHALLENGE_OPTIONS,
            llm_calls_used=self.llm_calls_used,
            llm_calls_limit=MAX_LLM_CALLS_PER_SESSION,
            messages=self.messages,
        )


class UltimatumStore:
    MAX_SESSIONS = 200

    def __init__(self) -> None:
        self._s: dict[str, UltimatumSession] = {}

    def create(self, avatar: Avatar) -> UltimatumSession:
        if len(self._s) >= self.MAX_SESSIONS:
            self._s.pop(next(iter(self._s)))
        s = UltimatumSession(avatar=avatar)
        self._s[s.session_id] = s
        return s

    def get(self, session_id: str) -> UltimatumSession:
        try:
            return self._s[session_id]
        except KeyError:
            raise GameError("Session not found. Start a new game.", status=404) from None
