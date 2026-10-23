# GTiA: Game Theory in Action

A 3D game that teaches game theory by having you play against AI characters. In Door 1,
**Dilemma Detectives**, you're interrogated about a heist alongside your partner, Tung Tung
Tung Sahur, and you build the Prisoner's Dilemma payoff matrix one cell at a time from your own
choices.

> Status (Oct 23): playable end to end, from avatar select to the hallway to Door 1 to the debrief.

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

Shortcuts for demos and screenshots: `/?play=kimchi` jumps straight into Door 1, and
`/?hall=yoshi` opens the hallway.

## Other commands

```bash
.venv/bin/python -m pytest -q              # 53 offline tests (engine + safety), no API key needed
.venv/bin/python scripts/smoke_run.py      # one full game against the real agents → output/smoke_run.md
```

## How it works

| Piece | File | What it does |
|---|---|---|
| Game engine | `backend/game/engine.py` | State machine; computes every sentence and checks every matrix answer. No LLM. |
| Coverage controller | `backend/game/coverage.py` | Constrains the partner's move so 4 rounds cover all 4 cells |
| Cop agent | `backend/agents/cop.py`, `prompts/cop.md` | Detective Byte: intro, chat, announces the engine's verdict |
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
- **Detective Byte:** the cop.
- **Tung Tung Tung Sahur:** the partner.
- **Nash-sensei:** the tutor, a kitsune sage.

The scenes are in `frontend/src/scenes/`: the avatar select screen, the hallway, the
interrogation room, and the cells.

## API

`POST /api/session {avatar}` · `POST /api/session/{id}/chat {message}` ·
`POST /api/session/{id}/move {move}` · `POST /api/session/{id}/cell {player_years, partner_years}` ·
`GET /api/session/{id}` · `GET /api/session/{id}/usage`
