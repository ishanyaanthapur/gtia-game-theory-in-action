"""Build docs/report.html (and docs/slides.html): single self-contained files with every screenshot embedded.

    .venv/bin/python scripts/build_report.py                                  # report
    .venv/bin/python scripts/build_report.py slides_template.html slides.html # slides

Placeholders in docs/report_template.html:
  {{IMG:name}}   -> <img> with output/screenshots/<name>.jpg inlined
  {{SVG:name}}   -> docs/<name>.svg inlined
  {{STAT:key}}   -> numbers computed from output/token_log.jsonl
"""
from __future__ import annotations

import base64
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DOCS = ROOT / "docs"
SHOTS = ROOT / "output" / "screenshots"


def stats() -> dict[str, str]:
    rows = [json.loads(line) for line in (ROOT / "output" / "token_log.jsonl").read_text().splitlines()]
    return {
        "total_runs": f"{len(rows):,}",
        "sessions": f"{len({r['session_id'] for r in rows}):,}",
        "total_input": f"{sum(r['input_tokens'] for r in rows):,}",
        "total_output": f"{sum(r['output_tokens'] for r in rows):,}",
    }


def main(template: str = "report_template.html", out: str = "report.html") -> None:
    html = (DOCS / template).read_text()
    st = stats()

    def img(m: re.Match) -> str:
        path = SHOTS / f"{m.group(1)}.jpg"
        data = base64.b64encode(path.read_bytes()).decode()
        return f'<img class="shot" src="data:image/jpeg;base64,{data}" alt="{m.group(1).replace("_", " ")}" />'

    html = re.sub(r"\{\{IMG:([\w-]+)\}\}", img, html)
    html = re.sub(r"\{\{SVG:([\w-]+)\}\}", lambda m: (DOCS / f"{m.group(1)}.svg").read_text(), html)
    html = re.sub(r"\{\{STAT:(\w+)\}\}", lambda m: st[m.group(1)], html)
    missing = re.findall(r"\{\{[A-Z]+:[\w-]+\}\}", html)
    assert not missing, f"unfilled placeholders: {missing}"
    (DOCS / out).write_text(html)
    print(f"wrote {DOCS / out} ({len(html) / 1e6:.1f} MB)")


if __name__ == "__main__":
    import sys

    main(*sys.argv[1:])
