from __future__ import annotations

import os

os.environ.setdefault("PYDANTIC_AI_NO_BANNER", "1")
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
OUTPUT_DIR = ROOT / "output"
PROMPTS_DIR = Path(__file__).resolve().parent / "prompts"
FRONTEND_DIST = ROOT / "frontend" / "dist"

MODEL_NAME = "gpt-6-luna"  # course key only allows gpt-6-luna


def load_env() -> Path | None:
    """Course rule: look for .env in the repo folder first, then exactly one folder up."""
    for candidate in (ROOT / ".env", ROOT.parent / ".env"):
        if candidate.is_file():
            load_dotenv(candidate)
            return candidate
    return None


ENV_FILE = load_env()


def require_api_key() -> str:
    key = os.environ.get("PORTKEY_API_KEY")
    if not key:
        raise RuntimeError(
            "PORTKEY_API_KEY not found. Copy .env.example to .env (in this folder or one folder up) "
            "and paste your Portkey key."
        )
    return key
