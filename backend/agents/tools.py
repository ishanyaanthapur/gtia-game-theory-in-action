"""Read-only tools shared by the agents. None of them can change the game state."""
from __future__ import annotations

from pydantic_ai import RunContext

from backend.agents.base import GameDeps


def get_round_history(ctx: RunContext[GameDeps]) -> list[dict]:
    """Every completed round so far: both moves and the resulting sentences."""
    return [
        {
            "round": r.round,
            "player_move": r.player_move.value,
            "tung_tung_move": r.partner_move.value,
            "player_years": r.player_years,
            "tung_tung_years": r.partner_years,
        }
        for r in ctx.deps.session.history
    ]


def get_case_file(ctx: RunContext[GameDeps]) -> dict:
    """Facts about the current interrogation (round number, suspect avatar)."""
    s = ctx.deps.session
    return {"round": s.round, "max_rounds": 4, "suspect": s.avatar.value, "partner": "Tung Tung Tung Sahur"}


def get_allowed_moves(ctx: RunContext[GameDeps]) -> list[str]:
    """The moves Tung Tung Tung Sahur may choose this round. Your move MUST be one of these."""
    return [m.value for m in ctx.deps.allowed_partner_moves or []]


def get_matrix_progress(ctx: RunContext[GameDeps]) -> list[dict]:
    """Which matrix cells the player has filled in so far (unfilled cells have no numbers)."""
    return [c.model_dump(mode="json") for c in ctx.deps.session.view().matrix]


def get_player_history(ctx: RunContext[GameDeps]) -> list[str]:
    """The player's moves in order, e.g. ['silent', 'silent', 'confess']."""
    return [r.player_move.value for r in ctx.deps.session.history]
