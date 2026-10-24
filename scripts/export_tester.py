"""Bundle every log for one tester into output/user_tests/<date>_<id>/ for the report.

    .venv/bin/python scripts/export_tester.py            # every tester in output/user_study.jsonl
    .venv/bin/python scripts/export_tester.py 1e6e6020   # one tester (participant id prefix)

Each folder gets:
  study.jsonl      their before + after check rows (raw)
  game_audit.jsonl every game event from their session (moves, verdicts, cell answers, AI outputs)
  tokens.jsonl     every AI call in their session (input / cached / output tokens, latency)
  transcript.md    a readable timeline: checks, each round, what every character said, matrix answers
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from backend.game.quiz import BY_ID  # noqa: E402
from backend.usage import AUDIT_LOG, STUDY_LOG, TOKEN_LOG  # noqa: E402

OUT_ROOT = STUDY_LOG.parent / "user_tests"
NAMES = {"cop": "Detective Zhou", "partner": "Tung Tung Tung Sahur", "tutor": "Nash-sensei"}


def read(path: Path) -> list[dict]:
    return [json.loads(line) for line in path.read_text().splitlines()] if path.exists() else []


def check_lines(row: dict) -> list[str]:
    lines = []
    for qid, a in row["answers"].items():
        q = BY_ID[qid]
        chose = "Not sure" if a is None else q.options[a]
        lines.append(f"- {'✓' if row['correct'][qid] else '✗'} **{q.concept}**: {q.prompt}  \n  chose: *{chose}*"
                     + ("" if row["correct"][qid] else f" (correct: *{q.options[q.answer]}*)"))
    return lines


def export(pid: str, study: list[dict], audit: list[dict], tokens: list[dict]) -> Path:
    rows = [r for r in study if r["participant_id"] == pid]
    pre = next((r for r in rows if r["phase"] == "pre"), None)
    post = next((r for r in rows if r["phase"] == "post"), None)
    sid = (post or {}).get("session_id")
    events = [e for e in audit if sid and e.get("session_id") == sid]
    calls = [t for t in tokens if sid and t.get("session_id") == sid]

    folder = OUT_ROOT / f"{(pre or post)['ts'][:10]}_{pid[:8]}"
    folder.mkdir(parents=True, exist_ok=True)
    for name, data in (("study.jsonl", rows), ("game_audit.jsonl", events), ("tokens.jsonl", calls)):
        (folder / name).write_text("".join(json.dumps(x, ensure_ascii=False) + "\n" for x in data))

    md = [f"# Tester {pid[:8]}", "", f"- Participant id: `{pid}`", f"- Game session: `{sid or '–'}`"]
    if post:
        md.append(f"- Before → after: {post.get('minutes_since_pre')} min · confidence {post.get('confidence')}/5 · "
                  f"usefulness {post.get('rating')}/5 · after score {post['score']}/{post['total']}")
    tin = sum(c["input_tokens"] for c in calls)
    md.append(f"- AI calls: {len(calls)} · input {tin:,} · cached {sum(c['cached_input_tokens'] for c in calls):,} · "
              f"output {sum(c['output_tokens'] for c in calls):,} tokens")
    if pre:
        md += ["", f"## Before-check ({pre['ts']})", *check_lines(pre)]
    md += ["", "## Game"]
    for e in events:
        ev = e["event"]
        if ev == "agent_output":
            text = e.get("output", {}).get("text") or e.get("output", {}).get("line", "")
            extra = f" *(move: {e['output']['move']})*" if "move" in e.get("output", {}) else ""
            md.append(f"- **{NAMES.get(e.get('agent'), e.get('agent'))}** [{e.get('purpose')}]{extra}: {text}")
        elif ev == "round_resolved":
            md.append(f"\n### Round {e['round']}: player **{e['player_move']}**, Tung Tung Tung Sahur **{e['partner_move']}** "
                      f"→ ({e['player_years']}, {e['partner_years']}) years"
                      + (" · partner forced" if e.get("partner_forced") else "") + "\n")
        elif ev == "cell_answer":
            md.append(f"- 🧮 Matrix answer round {e['round']}, attempt {e['attempt']}: {e['answer']} → "
                      f"{'✓ correct' if e['correct'] else '✗ wrong'}")
        elif ev in ("injection_attempt", "provider_content_filter", "partner_override", "agent_fallback"):
            md.append(f"- ⚠️ **{ev}**: {json.dumps({k: v for k, v in e.items() if k not in ('ts', 'session_id', 'event')})}")
    if post:
        md += ["", f"## After-check ({post['ts']})", *check_lines(post)]
        if post.get("feedback"):
            md += ["", f"**Feedback** ({'OK to quote' if post.get('consent_quote') else 'NOT consented for quoting'}): "
                       f"{post['feedback']}"]
    (folder / "transcript.md").write_text("\n".join(md) + "\n")
    return folder


def main() -> None:
    study, audit, tokens = read(STUDY_LOG), read(AUDIT_LOG), read(TOKEN_LOG)
    pids = list(dict.fromkeys(r["participant_id"] for r in study))
    if len(sys.argv) > 1:
        pids = [p for p in pids if p.startswith(sys.argv[1])]
    for pid in pids:
        print("exported", export(pid, study, audit, tokens))


if __name__ == "__main__":
    main()
