"""Coverage controller: guarantees the player visits all 4 matrix cells in at most 4 rounds.

The player picks the row and the partner picks the column. Plain code, not an LLM, decides which
partner moves are allowed, so the teaching guarantee never depends on the model behaving.
"""
from __future__ import annotations

from collections.abc import Iterable

from backend.game.payoffs import Cell, Move


def locked_player_moves(visited: Iterable[Cell]) -> list[Move]:
    """Rows the player has fully explored; the UI greys these buttons out ("Already explored")."""
    seen = set(visited)
    return [p for p in Move if all((p, q) in seen for q in Move)]


def allowed_partner_moves(player_move: Move, visited: Iterable[Cell]) -> list[Move]:
    """Partner moves that land in an unvisited cell of the player's row.

    Both open → the partner agent chooses freely. One open → that move is forced.
    """
    seen = set(visited)
    open_moves = [q for q in Move if (player_move, q) not in seen]
    return open_moves or list(Move)  # unreachable when locked rows are enforced
