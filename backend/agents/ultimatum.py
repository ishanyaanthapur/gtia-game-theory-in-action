"""Door 3 agents: Tung Tung Tung Sahur as responder and proposer, Nash-sensei as host/tutor."""
from __future__ import annotations

from dataclasses import dataclass

from pydantic import BaseModel, Field
from pydantic_ai import Agent, ModelRetry, RunContext

from backend.agents.base import load_prompt
from backend.game.ultimatum import POT, STEP, UltimatumSession
from backend.models import TutorReply


@dataclass
class UltDeps:
    session: UltimatumSession  # run_agent uses session.use_llm_call() + session.session_id


class UltResponse(BaseModel):
    accept: bool = Field(description="True to accept the player's offer, False to reject it (then nobody gets anything).")
    line: str = Field(description="One short in-character reaction, max 25 words.")
    reasoning: str = Field(description="One sentence on why (audit log only).")


class UltOffer(BaseModel):
    offer_to_player: int = Field(description=f"GPUs offered to the PLAYER: a multiple of {STEP} between 0 and {POT}.")
    line: str = Field(description="One short in-character pitch, max 25 words.")
    reasoning: str = Field(description="One sentence on why (audit log only).")


tung_responder = Agent(
    output_type=UltResponse,
    deps_type=UltDeps,
    system_prompt=load_prompt("ultimatum_tung"),
    name="tung_responder",
)

tung_proposer = Agent(
    output_type=UltOffer,
    deps_type=UltDeps,
    system_prompt=load_prompt("ultimatum_tung"),
    name="tung_proposer",
    retries=2,
)


@tung_proposer.output_validator
def valid_offer(ctx: RunContext[UltDeps], offer: UltOffer) -> UltOffer:
    """Guardrail: the offer must be a legal amount; otherwise the model must try again."""
    if not 0 <= offer.offer_to_player <= POT or offer.offer_to_player % STEP:
        raise ModelRetry(f"offer_to_player must be a multiple of {STEP} between 0 and {POT}.")
    return offer


ult_sensei = Agent(
    output_type=TutorReply,
    deps_type=UltDeps,
    system_prompt=load_prompt("ultimatum_sensei"),
    name="ult_sensei",
)
