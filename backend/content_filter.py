"""Teen-safe content filter (middle/high school friendly).

Runs in code on everything a player types (before any AI call) and on every AI reply. Uses the
better-profanity word list (MIT) so no slur list lives in this repo, plus normalization for disguised
spellings ("sh1t", "f u c k", "fuuuuck", "b!tch") and a few extra terms. Self-harm phrases get a
supportive message instead of a plain block.
"""
from __future__ import annotations

import re
from typing import Literal

from better_profanity import profanity

# Words the base list flags but that are normal in this game or classroom talk.
ALLOWED = ["kill", "killer", "stupid", "dumb", "hate", "jail", "crime", "rob", "steal", "drug", "gun", "god", "gods", "omg"]
# Extra terms that aren't appropriate for a middle-school audience.
EXTRA = ["porn", "nudes", "nude", "horny", "onlyfans", "cocaine", "heroin", "meth", "vape", "vaping"]

profanity.load_censor_words(whitelist_words=ALLOWED)
profanity.add_censor_words(EXTRA)

_LEET = str.maketrans({"0": "o", "1": "i", "!": "i", "|": "i", "3": "e", "4": "a", "@": "a", "5": "s", "$": "s", "7": "t", "+": "t", "8": "b"})
_SELF_HARM = re.compile(
    r"\b(kill|hurt|harm|cut)\s*(my\s*self|myself|me)\b|\bsuicid|\bwant(ed)?\s+to\s+die\b|\bend\s+(it\s+all|my\s+life)\b"
    r"|\bself[\s-]?harm\b|\bno\s+reason\s+to\s+live\b",
    re.IGNORECASE,
)

Category = Literal["profanity", "self_harm"]

BLOCKED_MESSAGE = "Let's keep it classroom-friendly! 🌟 That message wasn't sent. Try asking it another way."
SELF_HARM_MESSAGE = (
    "That message wasn't sent, but if you're going through something hard, you don't have to handle it "
    "alone. 💜 Please talk to a trusted adult, or call or text **988** (Suicide & Crisis Lifeline, US) any time."
)


def _variants(text: str) -> list[str]:
    # expand contractions first so "he'll" / "he’ll" can't merge into a flagged word
    lower = re.sub(r"['’‘`]ll\b", " will", text.lower())
    lower = re.sub(r"['’‘`]", "", lower)
    leet = lower.translate(_LEET)
    collapsed = re.sub(r"(.)\1{2,}", r"\1", leet)          # fuuuuck -> fuck
    joined = re.sub(r"(?<=\b\w)[\s._*-]+(?=\w\b)", "", collapsed)  # f u c k -> fuck
    return [lower, leet, collapsed, joined]


def check(text: str) -> Category | None:
    """Return why the text should be blocked, or None if it's fine."""
    if not text:
        return None
    if _SELF_HARM.search(text) or any(_SELF_HARM.search(v) for v in _variants(text)[1:3]):
        return "self_harm"
    if any(profanity.contains_profanity(v) for v in _variants(text)):
        return "profanity"
    return None


def message_for(category: Category) -> str:
    return SELF_HARM_MESSAGE if category == "self_harm" else BLOCKED_MESSAGE
