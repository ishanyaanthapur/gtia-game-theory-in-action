from __future__ import annotations

from pydantic_ai import Agent

from backend.agents.base import GameDeps, load_prompt
from backend.agents.tools import get_case_file, get_round_history
from backend.models import CopLine

cop_agent = Agent(
    output_type=CopLine,
    deps_type=GameDeps,
    system_prompt=load_prompt("cop"),
    tools=[get_case_file, get_round_history],
    name="cop",
)
