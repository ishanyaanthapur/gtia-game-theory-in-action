from __future__ import annotations

import time
from dataclasses import dataclass
from typing import TypeVar

from openai import AsyncOpenAI
from portkey_ai import PORTKEY_GATEWAY_URL, createHeaders
from pydantic_ai import Agent
from pydantic_ai.models.openai import OpenAIChatModel
from pydantic_ai.providers.openai import OpenAIProvider
from pydantic_ai.usage import UsageLimits

from backend.config import MODEL_NAME, PROMPTS_DIR, require_api_key
from backend.game.engine import GameSession
from backend.game.payoffs import Move
from backend.usage import audit, log_tokens

# Per-agent-run cap: one structured answer, a couple of read-only tool calls, one retry.
RUN_LIMITS = UsageLimits(request_limit=5, total_tokens_limit=12_000)

T = TypeVar("T")


@dataclass
class GameDeps:
    """Passed to every agent run; tools read (never write) the game state through this."""

    session: GameSession
    allowed_partner_moves: list[Move] | None = None  # set only for partner runs


_model: OpenAIChatModel | None = None


def get_model() -> OpenAIChatModel:
    """gpt-6-luna through Portkey (course key). Built lazily so tests run without a key."""
    global _model
    if _model is None:
        key = require_api_key()
        client = AsyncOpenAI(
            api_key=key,
            base_url=PORTKEY_GATEWAY_URL,
            default_headers=createHeaders(api_key=key, provider="openai"),
        )
        # gpt-6-luna rejects function tools unless reasoning_effort is "none" (same as hw5).
        _model = OpenAIChatModel(
            MODEL_NAME,
            provider=OpenAIProvider(openai_client=client),
            settings={"openai_reasoning_effort": "none"},
        )
    return _model


def load_prompt(name: str) -> str:
    return (PROMPTS_DIR / f"{name}.md").read_text()


async def run_agent(agent: Agent[GameDeps, T], prompt: str, deps: GameDeps, *, purpose: str) -> T:
    """Run one agent with the session budget, per-run limits, and token logging."""
    session = deps.session
    session.use_llm_call()  # raises GameError(429) once the session budget is spent
    start = time.perf_counter()
    result = await agent.run(prompt, deps=deps, model=get_model(), usage_limits=RUN_LIMITS)
    latency_ms = int((time.perf_counter() - start) * 1000)
    log_tokens(session.session_id, agent.name or "agent", purpose, result.usage, latency_ms)
    audit(session.session_id, "agent_output", agent=agent.name, purpose=purpose, output=result.output.model_dump())
    return result.output
