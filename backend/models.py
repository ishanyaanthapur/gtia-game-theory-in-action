from __future__ import annotations

from enum import StrEnum
from typing import Literal

from pydantic import BaseModel, Field

from backend.game.payoffs import Move


class Avatar(StrEnum):
    JUJUBEE = "jujubee"
    YOSHI = "yoshi"
    KIMCHI = "kimchi"


class Phase(StrEnum):
    INTERROGATION = "interrogation"  # chat with the cop, then choose a move
    MATRIX = "matrix"                # fill in this round's cell of the payoff matrix
    CHALLENGE = "challenge"          # matrix done: player must name their dominant strategy (can ask the tutor)
    COMPLETE = "complete"            # dominant strategy found (or revealed), debrief shown


# ---------- Agent outputs (pydantic-ai output_type) ----------

class CopLine(BaseModel):
    """What Detective Zhou says next."""

    text: str = Field(description="Detective Zhou's line, in character. Markdown allowed. Max ~80 words.")
    mood: Literal["smug", "stern", "suspicious", "amused", "triumphant"] = "stern"


class PartnerDecision(BaseModel):
    """Tung Tung Tung Sahur's move for this round."""

    move: Move = Field(description="Must be one of the moves returned by get_allowed_moves().")
    line: str = Field(description="One short in-character line Tung Tung Tung Sahur shouts from the other room. Max 25 words.")
    reasoning: str = Field(description="One sentence on why, for the audit log (not shown to the player).")


class TutorReply(BaseModel):
    """What Nash-sensei says."""

    text: str = Field(description="Nash-sensei's message. Markdown allowed. Max ~90 words.")


# ---------- Game records ----------

class RoundResult(BaseModel):
    round: int
    player_move: Move
    partner_move: Move
    player_years: int
    partner_years: int
    partner_forced: bool = Field(description="True if the coverage controller allowed only one partner move.")
    partner_overridden: bool = Field(default=False, description="True if the engine had to replace the agent's move.")
    partner_line: str = ""
    cell_answered: bool = False
    cell_attempts: int = 0


class MatrixCell(BaseModel):
    player_move: Move
    partner_move: Move
    revealed: bool
    player_years: int | None = None
    partner_years: int | None = None


class Message(BaseModel):
    speaker: Literal["cop", "partner", "tutor", "player", "system"]
    text: str
    mood: str | None = None


class SessionView(BaseModel):
    """Everything the frontend needs to render the current state."""

    session_id: str
    avatar: Avatar
    phase: Phase
    round: int
    max_rounds: int
    locked_moves: list[Move]
    cop_messages_left: int
    tutor_questions_left: int
    challenge_attempts: int
    dominant_found: bool | None = None  # None until the challenge ends; True if they got it (not revealed)
    llm_calls_used: int
    llm_calls_limit: int
    matrix: list[MatrixCell]
    history: list[RoundResult]
    messages: list[Message]


# ---------- API request bodies ----------

class NewSessionRequest(BaseModel):
    avatar: Avatar


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=300)


class MoveRequest(BaseModel):
    move: Move


class CellAnswer(BaseModel):
    player_years: int = Field(ge=0, le=10)
    partner_years: int = Field(ge=0, le=10)


class QuizSubmission(BaseModel):
    """One before/after understanding check. participant_id is random and links pre to post (no names)."""

    participant_id: str = Field(pattern=r"^[a-z0-9-]{6,40}$")
    phase: Literal["pre", "post"]
    answers: dict[str, int | None] = Field(description="question id -> chosen option index (None = 'Not sure')")
    confidence: int | None = Field(default=None, ge=1, le=5, description="Post only: confidence explaining the PD, 1-5")
    rating: int | None = Field(default=None, ge=1, le=5, description="Post only: how useful was the game? 1-5")
    feedback: str | None = Field(default=None, max_length=500)
    consent_quote: bool = False
    session_id: str | None = Field(default=None, max_length=40)
    preview: bool = Field(default=False, description="Preview mode (?preview=pre|post): grade but don't save")


class PreLink(BaseModel):
    """The one question this player saw before the game, and how they did on it before vs after."""

    question_id: str
    concept: str
    correct_before: bool
    correct_after: bool


class QuizResult(BaseModel):
    phase: Literal["pre", "post"]
    score: int
    total: int
    results: list[dict]
    pre: PreLink | None = None  # filled on "post" when this participant has a pre-check on file
    minutes_since_pre: float | None = None


class TurnResponse(BaseModel):
    """Returned by every action endpoint: the new messages from this turn plus the full state."""

    new_messages: list[Message]
    correct: bool | None = None
    state: SessionView
