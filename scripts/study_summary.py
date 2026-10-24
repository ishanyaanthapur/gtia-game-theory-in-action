"""Summarize the before/after understanding checks for the report's Impact section.

    .venv/bin/python scripts/study_summary.py

Reads output/user_study.jsonl (one line per check submitted) and writes
output/user_study_summary.md: headline numbers, a per-question table, and consented quotes.

Learning gain = the ONE question each player saw before the game, answered again after the game.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path
from statistics import mean, median

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from backend.game.quiz import BY_ID, QUESTIONS  # noqa: E402
from backend.usage import AUDIT_LOG, STUDY_LOG  # noqa: E402

MD_OUT = STUDY_LOG.parent / "user_study_summary.md"


def pct(xs: list[bool]) -> str:
    return f"{100 * mean(xs):.0f}%" if xs else "–"


def matrix_first_try(session_id: str | None) -> tuple[int, int]:
    """(cells right on the first attempt, cells attempted) for one game, from the audit log."""
    if not session_id or not AUDIT_LOG.exists():
        return 0, 0
    first = {}
    for line in AUDIT_LOG.read_text().splitlines():
        e = json.loads(line)
        if e.get("session_id") == session_id and e.get("event") == "cell_answer" and e.get("attempt") == 1:
            first[e["round"]] = e["correct"]
    return sum(first.values()), len(first)


def mark(ok: bool | None) -> str:
    return "–" if ok is None else ("✓" if ok else "✗")


def main() -> None:
    rows = [json.loads(line) for line in STUDY_LOG.read_text().splitlines()] if STUDY_LOG.exists() else []
    pre = {r["participant_id"]: r for r in rows if r["phase"] == "pre"}
    post = {r["participant_id"]: r for r in rows if r["phase"] == "post"}
    # ---- Markdown summary ----
    paired = [(pre[p], post[p]) for p in post if p in pre]
    lines = ["# User study: before/after understanding check", ""]
    lines.append(f"- Players who started: {len(pre)} · finished the after-check: {len(post)} · **paired: {len(paired)}**")
    if paired:
        before = [a["correct"][a["asked"][0]] for a, _ in paired]
        after = [z["correct"].get(a["asked"][0], False) for a, z in paired]
        lines += [
            f"- **Same question, before → after: {pct(before)} → {pct(after)} correct** "
            f"({sum((not b) and c for b, c in zip(before, after))} of {len(paired)} went from wrong/not sure to right)",
            f"- After-check score (all 5 questions): mean {mean(z['score'] for _, z in paired):.1f}/5",
        ]
        ratings = [z["rating"] for _, z in paired if z.get("rating")]
        conf = [z["confidence"] for _, z in paired if z.get("confidence")]
        minutes = [z["minutes_since_pre"] for _, z in paired if z.get("minutes_since_pre") is not None]
        if ratings:
            lines.append(f"- Usefulness (1–5): mean {mean(ratings):.1f}")
        if conf:
            lines.append(f"- Confidence explaining the PD after playing (1–5): mean {mean(conf):.1f}")
        if minutes:
            lines.append(f"- Time from before-check to after-check: median {median(minutes):.0f} min")
        lines += ["", "## Per question", "", "| Concept | Asked before (n) | Correct before | Same players after | All players after |", "|---|---|---|---|---|"]
        for q in QUESTIONS:
            group = [(a, z) for a, z in paired if a["asked"][0] == q.id]
            all_after = [z["correct"][q.id] for z in post.values() if q.id in z["correct"]]
            lines.append(
                f"| {q.concept} ({q.id}) | {len(group)} | {pct([a['correct'][q.id] for a, _ in group])} | "
                f"{pct([z['correct'][q.id] for _, z in group])} | {pct(all_after)} |"
            )
    else:
        lines.append("\nNo paired results yet. Testers should enter Door 1 from the hallway (or use `/?play=kimchi&check=1`).")
    # ---- one row per tester: progress from before -> game -> after ----
    if pre or post:
        head = "| Tester | Before question | Right first time? | Same question after | " + " | ".join(q.concept for q in QUESTIONS)
        lines += ["", "## Per tester", "", head + " | After score | Matrix cells right on 1st try | Confidence | Useful | Min |",
                  "|" + "---|" * (10 + len(QUESTIONS) - 1)]
        for pid in dict.fromkeys([*pre, *post]):
            a, z = pre.get(pid), post.get(pid)
            qid = a["asked"][0] if a else None
            right, tried = matrix_first_try((z or {}).get("session_id"))
            per_q = " | ".join(mark(z["correct"].get(q.id)) if z else "–" for q in QUESTIONS)
            lines.append(
                f"| {pid[:8]} | {BY_ID[qid].concept if qid else '–'} | {mark(a['correct'][qid]) if a else '–'} | "
                f"{mark(z['correct'].get(qid)) if a and z else '–'} | {per_q} | {z['score'] if z else '–'}/5 | "
                f"{f'{right}/{tried}' if tried else '–'} | {(z or {}).get('confidence') or '–'} | {(z or {}).get('rating') or '–'} | "
                f"{(z or {}).get('minutes_since_pre') or '–'} |"
            )
    quotes = [z["feedback"] for z in post.values() if z.get("feedback") and z.get("consent_quote")]
    if quotes:
        lines += ["", "## Quotes (consented)", ""] + [f"> {q}" for q in quotes]
    MD_OUT.write_text("\n".join(lines) + "\n")
    print("\n".join(lines))
    print(f"\nWrote {MD_OUT}")


if __name__ == "__main__":
    main()
