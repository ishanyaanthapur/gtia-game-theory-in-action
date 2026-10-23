"""Summarize the before/after understanding checks for the report's Impact section.

    .venv/bin/python scripts/study_summary.py

Reads output/user_study.jsonl and writes output/user_study_summary.md. Only participants with BOTH
a pre and a post check are counted in the before/after comparison.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path
from statistics import mean, median

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from backend.game.quiz import QUESTIONS  # noqa: E402
from backend.usage import STUDY_LOG  # noqa: E402

OUT = STUDY_LOG.parent / "user_study_summary.md"


def main() -> None:
    rows = [json.loads(line) for line in STUDY_LOG.read_text().splitlines()] if STUDY_LOG.exists() else []
    pre = {r["participant_id"]: r for r in rows if r["phase"] == "pre"}
    post = {r["participant_id"]: r for r in rows if r["phase"] == "post"}
    paired = [(pre[p], post[p]) for p in post if p in pre]
    n = len(paired)
    lines = ["# User study: before/after understanding check", ""]
    lines.append(f"- Pre-checks: {len(pre)} · post-checks: {len(post)} · **paired participants: {n}**")
    if not n:
        lines.append("\nNo paired results yet. Have testers play Door 1 from the hallway (not `?play=`).")
    else:
        b = [a["score"] for a, _ in paired]
        f = [z["score"] for _, z in paired]
        gains = [y - x for x, y in zip(b, f)]
        conf_b = [a["confidence"] for a, _ in paired]
        conf_a = [z["confidence"] for _, z in paired]
        ratings = [z["rating"] for _, z in paired if z.get("rating")]
        minutes = [z["minutes_since_pre"] for _, z in paired if z.get("minutes_since_pre") is not None]
        total = paired[0][0]["total"]
        lines += [
            f"- Mean score: **{mean(b):.1f}/{total} → {mean(f):.1f}/{total}** (mean gain {mean(gains):+.1f}; "
            f"{sum(g > 0 for g in gains)}/{n} improved, {sum(g < 0 for g in gains)}/{n} dropped)",
            f"- Confidence explaining the PD (1–5): {mean(conf_b):.1f} → {mean(conf_a):.1f}",
            f"- Usefulness rating (1–5): {mean(ratings):.1f}" if ratings else "- Usefulness rating: n/a",
            f"- Time from pre-check to post-check: median {median(minutes):.0f} min" if minutes else "",
            "",
            "## Per question (% correct before → after)",
            "",
            "| Concept | Question | Before | After |",
            "|---|---|---|---|",
        ]
        for i, q in enumerate(QUESTIONS):
            before = mean(a["correct"][i] for a, _ in paired) * 100
            after = mean(z["correct"][i] for _, z in paired) * 100
            lines.append(f"| {q.concept} | {q.id} | {before:.0f}% | {after:.0f}% |")
        lines += ["", "## Participants", "", "| Participant | Before | After | Confidence | Rating | Minutes |", "|---|---|---|---|---|---|"]
        for a, z in paired:
            lines.append(
                f"| {a['participant_id'][:8]} | {a['score']} | {z['score']} | {a['confidence']}→{z['confidence']} | "
                f"{z.get('rating') or '–'} | {z.get('minutes_since_pre') or '–'} |"
            )
    quotes = [z["feedback"] for z in post.values() if z.get("feedback") and z.get("consent_quote")]
    if quotes:
        lines += ["", "## Quotes (consented)", ""] + [f"> {q}" for q in quotes]
    OUT.write_text("\n".join(l for l in lines if l is not None) + "\n")
    print("\n".join(lines))
    print(f"\nWritten to {OUT}")


if __name__ == "__main__":
    main()
