from __future__ import annotations

from enum import StrEnum


class Move(StrEnum):
    SILENT = "silent"    # cooperate with your partner (refuse to talk)
    CONFESS = "confess"  # defect: blame your partner


Cell = tuple[Move, Move]  # (your move, partner's move)

# Years in jail as (you, partner). Lower is better.
PAYOFFS: dict[Cell, tuple[int, int]] = {
    (Move.SILENT, Move.SILENT): (1, 1),
    (Move.SILENT, Move.CONFESS): (3, 0),
    (Move.CONFESS, Move.SILENT): (0, 3),
    (Move.CONFESS, Move.CONFESS): (2, 2),
}

ALL_CELLS: tuple[Cell, ...] = tuple(PAYOFFS)


def sentence(player: Move, partner: Move) -> tuple[int, int]:
    return PAYOFFS[(player, partner)]
