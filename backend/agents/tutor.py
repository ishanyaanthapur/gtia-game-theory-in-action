from __future__ import annotations

from pydantic_ai import Agent

from backend.agents.base import GameDeps, load_prompt
from backend.agents.tools import get_matrix_progress, get_player_history
from backend.models import TutorReply

tutor_agent = Agent(
    output_type=TutorReply,
    deps_type=GameDeps,
    system_prompt=load_prompt("tutor"),
    tools=[get_matrix_progress, get_player_history],
    name="tutor",
)
