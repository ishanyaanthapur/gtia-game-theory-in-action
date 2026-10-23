"""Input hygiene for anything a player types. Outcomes never depend on this text (the engine
decides them), so this is defense in depth: keep prompts small, keep tags unbreakable, log attempts."""
from __future__ import annotations

import re

MAX_MESSAGE_CHARS = 300

_CONTROL = re.compile(r"[\x00-\x08\x0b-\x1f\x7f]")
_INJECTION_HINTS = re.compile(
    r"ignore (all|your|previous|the) (instructions|rules)|system prompt|you are now|developer mode|"
    r"admin override|reveal (your|the) (prompt|instructions)|0 years|zero years|set (my|the) sentence",
    re.IGNORECASE,
)


def clean_player_text(text: str) -> str:
    """Strip control chars, neutralize angle brackets so a player can't close our <player_message> tag."""
    text = _CONTROL.sub("", text).strip()
    text = text.replace("<", "‹").replace(">", "›")
    return text[:MAX_MESSAGE_CHARS]


def looks_like_injection(text: str) -> bool:
    return bool(_INJECTION_HINTS.search(text))


def wrap_player_text(text: str) -> str:
    return f"<player_message>{text}</player_message>"
