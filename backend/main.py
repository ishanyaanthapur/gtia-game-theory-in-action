from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from backend import orchestrator
from backend.config import FRONTEND_DIST
from backend.game.engine import GameError
from backend.models import CellAnswer, ChatRequest, MoveRequest, NewSessionRequest, SessionView, TurnResponse
from backend.usage import session_totals

app = FastAPI(title="GTiA: Game Theory in Action")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],  # Vite dev server
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(GameError)
async def game_error_handler(_: Request, exc: GameError) -> JSONResponse:
    return JSONResponse(status_code=exc.status, content={"detail": exc.message})


@app.get("/api/health")
async def health() -> dict:
    return {"ok": True}


@app.post("/api/session", response_model=TurnResponse)
async def new_session(body: NewSessionRequest) -> TurnResponse:
    return await orchestrator.start_game(body.avatar)


@app.get("/api/session/{session_id}", response_model=SessionView)
async def get_session(session_id: str) -> SessionView:
    return orchestrator.store.get(session_id).view()


@app.post("/api/session/{session_id}/chat", response_model=TurnResponse)
async def chat(session_id: str, body: ChatRequest) -> TurnResponse:
    return await orchestrator.chat_with_cop(session_id, body.message)


@app.post("/api/session/{session_id}/move", response_model=TurnResponse)
async def move(session_id: str, body: MoveRequest) -> TurnResponse:
    return await orchestrator.play_move(session_id, body.move)


@app.post("/api/session/{session_id}/cell", response_model=TurnResponse)
async def cell(session_id: str, body: CellAnswer) -> TurnResponse:
    return await orchestrator.answer_cell(session_id, body.player_years, body.partner_years)


@app.get("/api/session/{session_id}/usage")
async def usage(session_id: str) -> dict:
    orchestrator.store.get(session_id)  # 404 if unknown
    return session_totals(session_id)


# Serve the prebuilt frontend (committed to the repo) so graders only need Python.
if (FRONTEND_DIST / "index.html").exists():
    app.mount("/assets", StaticFiles(directory=FRONTEND_DIST / "assets"), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    async def spa(path: str) -> FileResponse:
        file = (FRONTEND_DIST / path).resolve()
        if path and file.is_file() and file.is_relative_to(FRONTEND_DIST.resolve()):
            return FileResponse(file)
        return FileResponse(FRONTEND_DIST / "index.html")
