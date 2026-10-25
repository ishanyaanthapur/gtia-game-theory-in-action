from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from backend import orchestrator
from backend.config import FRONTEND_DIST
from backend.game.engine import GameError
from datetime import datetime
from typing import Literal

from backend.game import quiz
from backend.models import (
    CellAnswer,
    ChatRequest,
    MoveRequest,
    NewSessionRequest,
    PreLink,
    QuizResult,
    QuizSubmission,
    SessionView,
    TurnResponse,
)
from backend.safety import clean_player_text
from backend.usage import find_pre, log_study, pre_question_counts, session_totals

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
    return await orchestrator.play_move(session_id, body.move, body.prediction)


@app.post("/api/session/{session_id}/cell", response_model=TurnResponse)
async def cell(session_id: str, body: CellAnswer) -> TurnResponse:
    return await orchestrator.answer_cell(session_id, body.player_years, body.partner_years)


@app.post("/api/session/{session_id}/tutor", response_model=TurnResponse)
async def tutor_question(session_id: str, body: ChatRequest) -> TurnResponse:
    """Challenge phase: ask Nash-sensei a question before naming the dominant strategy."""
    return await orchestrator.ask_tutor(session_id, body.message)


@app.post("/api/session/{session_id}/dominant", response_model=TurnResponse)
async def dominant(session_id: str, body: MoveRequest) -> TurnResponse:
    """Challenge phase: the player names their dominant strategy (graded in code)."""
    return await orchestrator.answer_dominant(session_id, body.move)


@app.get("/api/session/{session_id}/usage")
async def usage(session_id: str) -> dict:
    orchestrator.store.get(session_id)  # 404 if unknown
    return session_totals(session_id)


# ---------- before/after understanding check (no LLM) ----------

@app.get("/api/quiz")
async def get_quiz(phase: Literal["pre", "post"] = "post") -> dict:
    """Pre: ONE rotating question. Post: all 5."""
    if phase == "pre":
        ids = [quiz.pick_pre_question(pre_question_counts())]
        return {"scenario": quiz.SCENARIO, "questions": quiz.public_questions(ids), "matrix": None}
    # After the game the player has built the matrix, so show it (check v2).
    return {"scenario": quiz.POST_SCENARIO, "questions": quiz.public_questions(), "matrix": quiz.payoff_table()}


@app.post("/api/quiz", response_model=QuizResult)
async def submit_quiz(body: QuizSubmission) -> QuizResult:
    expected = 1 if body.phase == "pre" else len(quiz.QUESTIONS)
    if len(body.answers) != expected or any(qid not in quiz.BY_ID for qid in body.answers):
        raise GameError(f"The {body.phase}-check needs answers to exactly {expected} known question(s).", status=422)
    for qid, a in body.answers.items():
        if a is not None and not 0 <= a < len(quiz.BY_ID[qid].options):
            raise GameError("One of those answers isn't a valid option.", status=422)

    score, results = quiz.grade(body.answers)
    correct = {r["id"]: r["correct"] for r in results}
    feedback = clean_player_text(body.feedback)[:500] if body.feedback else None
    pre = find_pre(body.participant_id) if body.phase == "post" else None
    minutes, link = None, None
    if pre:
        minutes = round((datetime.now().astimezone() - datetime.fromisoformat(pre["ts"])).total_seconds() / 60, 1)
        qid = pre["asked"][0]
        link = PreLink(
            question_id=qid,
            concept=quiz.BY_ID[qid].concept,
            correct_before=pre["correct"][qid],
            correct_after=correct.get(qid, False),
        )
    if body.preview:  # demo/screenshot mode: grade only, never touch the study data
        return QuizResult(phase=body.phase, score=score, total=len(results), results=results)
    log_study(
        {
            "participant_id": body.participant_id,
            "phase": body.phase,
            "check_version": quiz.CHECK_VERSION,
            "asked": list(body.answers),
            "answers": body.answers,
            "correct": correct,
            "score": score,
            "total": len(results),
            "confidence": body.confidence,
            "rating": body.rating,
            "feedback": feedback,
            "consent_quote": body.consent_quote,
            "session_id": body.session_id,
            "minutes_since_pre": minutes,
        }
    )
    return QuizResult(phase=body.phase, score=score, total=len(results), results=results, pre=link, minutes_since_pre=minutes)


# Serve the prebuilt frontend (committed to the repo) so graders only need Python.
if (FRONTEND_DIST / "index.html").exists():
    app.mount("/assets", StaticFiles(directory=FRONTEND_DIST / "assets"), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    async def spa(path: str) -> FileResponse:
        file = (FRONTEND_DIST / path).resolve()
        if path and file.is_file() and file.is_relative_to(FRONTEND_DIST.resolve()):
            return FileResponse(file)
        return FileResponse(FRONTEND_DIST / "index.html")
