"""Token + audit logging. Every agent run appends one line to output/token_log.jsonl."""
from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from pydantic_ai.usage import RunUsage

from backend.config import OUTPUT_DIR

TOKEN_LOG = OUTPUT_DIR / "token_log.jsonl"
AUDIT_LOG = OUTPUT_DIR / "audit_trail.jsonl"
STUDY_LOG = OUTPUT_DIR / "user_study.jsonl"


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _append(path: Path, record: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a") as f:
        f.write(json.dumps(record, default=str) + "\n")


def log_tokens(session_id: str, agent: str, purpose: str, usage: RunUsage, latency_ms: int) -> dict[str, Any]:
    record = {
        "ts": _now(),
        "session_id": session_id,
        "agent": agent,
        "purpose": purpose,
        "requests": usage.requests,
        "input_tokens": usage.input_tokens,
        "cached_input_tokens": usage.cache_read_tokens,
        "output_tokens": usage.output_tokens,
        "latency_ms": latency_ms,
    }
    _append(TOKEN_LOG, record)
    return record


def audit(session_id: str, event: str, **detail: Any) -> None:
    _append(AUDIT_LOG, {"ts": _now(), "session_id": session_id, "event": event, **detail})


def session_totals(session_id: str) -> dict[str, int]:
    totals = {"agent_runs": 0, "requests": 0, "input_tokens": 0, "cached_input_tokens": 0, "output_tokens": 0}
    if not TOKEN_LOG.exists():
        return totals
    for line in TOKEN_LOG.read_text().splitlines():
        rec = json.loads(line)
        if rec["session_id"] != session_id:
            continue
        totals["agent_runs"] += 1
        for k in ("requests", "input_tokens", "cached_input_tokens", "output_tokens"):
            totals[k] += rec[k]
    return totals


def log_study(record: dict[str, Any]) -> None:
    _append(STUDY_LOG, {"ts": _now(), **record})


def find_pre(participant_id: str) -> dict[str, Any] | None:
    """Most recent pre-check for this participant, if any."""
    if not STUDY_LOG.exists():
        return None
    pre = None
    for line in STUDY_LOG.read_text().splitlines():
        rec = json.loads(line)
        if rec.get("participant_id") == participant_id and rec.get("phase") == "pre":
            pre = rec
    return pre
