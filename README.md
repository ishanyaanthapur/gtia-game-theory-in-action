# GTiA: Game Theory in Action

A 3D game that teaches game theory by having you play against AI characters. Two doors are open in
**Equilibrium Hall**. In Door 1,
**Dilemma Detectives**, you're interrogated about a heist alongside your partner, Tung Tung Tung Sahur, and you build the Prisoner's Dilemma payoff matrix one cell at a time from your own
choices.

> Status (Oct 23): playable end to end, from avatar select to the hallway to Door 1 to the debrief.

**Door 3, The Ultimatum,** takes place in a bright King's Cross station. You and Tung Tung Tung Sahur
split 10,000 stolen H100s over 4 alternating rounds. The proposer offers a split; the responder accepts
or rejects, and a rejection means nobody gets anything. The AI genuinely decides whether to accept and
what to offer, with personality and memory, while code validates offers and computes payouts. It ends
with a **backward induction** challenge and a game-tree debrief.

## Run it (about 2 minutes)

You need Python 3.11+ and a Portkey key.

```bash
cp .env.example .env        # then paste your PORTKEY_API_KEY into .env
./run.sh                    # creates .venv, installs deps, opens http://127.0.0.1:8000
```

Tested from a fresh clone on macOS with Python 3.14: about 50 seconds from `git clone` to a running
game. Options: `PORT=8080 ./run.sh`, `NO_BROWSER=1 ./run.sh`.

The app looks for `.env` in this folder first, then one folder up. It uses only `gpt-6-luna`
through Portkey.

## Develop the frontend (optional; needs Node 20+)

The built frontend in `frontend/dist/` is committed, so you only need Node to change it.

```bash
cd frontend && npm install && npm run dev   # Vite on :5173 proxies /api to :8000
npm run build                                # rebuild dist/ (served by FastAPI)
```

Shortcuts for demos and screenshots:
- `/?play=kimchi` jumps straight into Door 1.
- `/?play=kimchi&check=1` starts at the before-check, which is useful for user tests.
- `/?hall=yoshi` opens the hallway.
- `/?ultimatum=kimchi` jumps straight into Door 3.
- `/?preview=pre` and `/?preview=post` open the before- and after-checks in **preview mode**. Answers are graded but never saved, so use these for screenshots and demos.

## Before/after understanding check (user study)

- **Before:** players who enter Door 1 from the hallway answer **one** multiple-choice question. The
  server rotates through 5 questions, picking the one asked least often, so each concept gets
  covered. "Not sure" is always an option.
- **After the debrief:** players answer all 5 questions (including the one they saw before), give
  a 1–5 confidence and usefulness rating, and can leave an optional quote with consent.
- **Learning gain:** the same question for the same player, before vs. after.
- **Storage:** results are appended to `output/user_study.jsonl` under a random ID, with no names.
  Grading is done in code, so the check costs no tokens.
- **Summary:** `.venv/bin/python scripts/study_summary.py` writes `output/user_study_summary.md`.

## Other commands

```bash
.venv/bin/python -m pytest -q              # 88 offline tests (both games, safety, quiz), no API key needed
.venv/bin/python scripts/smoke_run.py      # one full game against the real agents → output/smoke_run.md
```

## How it works

| Piece | File | What it does |
|---|---|---|
| Game engine | `backend/game/engine.py` | State machine; computes every sentence and checks every matrix answer. No LLM. |
| Coverage controller | `backend/game/coverage.py` | Constrains the partner's move so 4 rounds cover all 4 cells |
| Cop agent | `backend/agents/cop.py`, `prompts/cop.md` | Detective Zhou: intro, chat, announces the engine's verdict |
| Partner agent | `backend/agents/partner.py`, `prompts/partner.md` | Tung Tung Tung Sahur: picks a move from the allowed set (an output validator enforces it) |
| Tutor agent | `backend/agents/tutor.py`, `prompts/tutor.md` | Nash-sensei: asks for each cell, gives hints, nudges, runs the debrief |
| Orchestrator | `backend/orchestrator.py` | Turns player actions into engine updates and agent calls, with fallbacks |
| Safety | `backend/safety.py`, `game/engine.py` | Input cleaning, injection logging, per-round chat cap, per-session AI-call budget |
| Logs | `output/token_log.jsonl`, `output/audit_trail.jsonl` | Input, cached-input, and output tokens per agent run, plus every game event |

All agents are `pydantic_ai.Agent`s with typed Pydantic outputs and read-only tools.

## Frontend

React + three.js (`@react-three/fiber`). Every character is built from primitives in
`frontend/src/characters/`:
- **The player:** Yoshi, a tabby cat; Jujubee, a golden dog; or Kimchi, a panda. All are samurai.
- **Detective Zhou:** the cop.
- **Tung Tung Tung Sahur:** the partner.
- **Nash-sensei:** the tutor, a kitsune sage.

The scenes are in `frontend/src/scenes/`: the avatar select screen, **Equilibrium Hall** (the
hallway of game doors), the interrogation room, and the cells.

## API

`POST /api/session {avatar}` · `POST /api/session/{id}/chat {message}` ·
`POST /api/session/{id}/move {move}` · `POST /api/session/{id}/cell {player_years, partner_years}` ·
`GET /api/session/{id}` · `GET /api/session/{id}/usage`
