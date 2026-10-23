from __future__ import annotations

from pydantic_ai import Agent, ModelRetry, RunContext

from backend.agents.base import GameDeps, load_prompt
from backend.agents.tools import get_allowed_moves, get_round_history
from backend.models import PartnerDecision

partner_agent = Agent(
    output_type=PartnerDecision,
    deps_type=GameDeps,
    system_prompt=load_prompt("partner"),
    tools=[get_allowed_moves, get_round_history],
    name="partner",
    retries=2,
)


@partner_agent.output_validator
def enforce_allowed_move(ctx: RunContext[GameDeps], decision: PartnerDecision) -> PartnerDecision:
    """Guardrail: the coverage controller decides which moves are legal; reject anything else."""
    allowed = ctx.deps.allowed_partner_moves or []
    if decision.move not in allowed:
        raise ModelRetry(
            f"'{decision.move.value}' is not allowed this round. Choose one of: {[m.value for m in allowed]}."
        )
    return decision
