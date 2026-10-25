"""Turns player actions into engine updates + agent calls. The engine owns the rules; agents own
the voices. If an agent fails, the game falls back to a canned line instead of breaking."""
from __future__ import annotations

from pydantic_ai.exceptions import AgentRunError, ModelAPIError

from backend.agents.base import GameDeps, run_agent
from backend.agents.cop import cop_agent
from backend.agents.partner import partner_agent
from backend.agents.tutor import tutor_agent
from backend.game.engine import GameError, GameSession, SessionStore
from backend.game.payoffs import Move
from backend.models import Avatar, CopLine, Message, Phase, TurnResponse, TutorReply
from backend.safety import clean_player_text, looks_like_injection, wrap_player_text
from backend.usage import audit

store = SessionStore()

# AgentRunError covers bad output after retries + per-run usage limits; ModelAPIError covers
# network/HTTP/rate-limit failures from Portkey.
AGENT_FAILURES = (AgentRunError, ModelAPIError)


FILTERED_COP_LINE = (
    "*Detective Zhou slowly closes his laptop.* Cute hacking attempt, but I don't take orders from suspects. "
    "The deal hasn't changed: **stay silent or confess?**"
)


def _is_content_filter(exc: Exception) -> bool:
    return "content management policy" in str(exc) or "content_filter" in str(exc)


# Fixed teaching point per cell, so the tutor never misreads which outcome is good for whom.
CELL_LESSONS: dict[tuple[Move, Move], str] = {
    (Move.SILENT, Move.SILENT): "mutual cooperation: 1 year each, better for BOTH than both confessing (2 each)",
    (Move.SILENT, Move.CONFESS): "the sucker's payoff: you stayed loyal but Tung Tung Tung Sahur betrayed you, so YOU get the worst "
    "outcome (3 years) while Tung Tung Tung Sahur walks free",
    (Move.CONFESS, Move.SILENT): "the temptation payoff: you betrayed a loyal partner and walk free (0), the best "
    "outcome for you and the worst for Tung Tung Tung Sahur (3)",
    (Move.CONFESS, Move.CONFESS): "mutual defection: 2 years each, worse for both than if both had stayed silent",
}


# The challenge question is fixed text (not AI-generated) so every player sees exactly the same prompt.
CHALLENGE_QUESTION = (
    "**Which is YOUR dominant strategy, Stay Silent or Confess?** Look at the matrix to see which strategy "
    "always gives YOU the better outcome. Ask me anything first. Just type below."
)


def _label(m: Move) -> str:
    return "Stay Silent" if m == Move.SILENT else "Confess"


def _say(session: GameSession, new: list[Message], msg: Message) -> None:
    session.messages.append(msg)
    new.append(msg)


async def _cop(session: GameSession, prompt: str, purpose: str, fallback: str) -> Message:
    try:
        line: CopLine = await run_agent(cop_agent, prompt, GameDeps(session), purpose=purpose)
        return Message(speaker="cop", text=line.text, mood=line.mood)
    except AGENT_FAILURES as exc:
        if _is_content_filter(exc):  # provider-side jailbreak/content filter blocked the prompt
            audit(session.session_id, "provider_content_filter", agent="cop", purpose=purpose)
            return Message(speaker="cop", text=FILTERED_COP_LINE, mood="suspicious")
        audit(session.session_id, "agent_fallback", agent="cop", purpose=purpose, error=str(exc))
        return Message(speaker="cop", text=fallback, mood="stern")


async def _tutor(session: GameSession, prompt: str, purpose: str, fallback: str) -> Message:
    try:
        reply: TutorReply = await run_agent(tutor_agent, prompt, GameDeps(session), purpose=purpose)
        return Message(speaker="tutor", text=reply.text)
    except AGENT_FAILURES as exc:
        audit(session.session_id, "agent_fallback", agent="tutor", purpose=purpose, error=str(exc))
        return Message(speaker="tutor", text=fallback)


async def _intro(session: GameSession, new: list[Message]) -> None:
    prev = session.history[-1] if session.history else None
    recap = (
        f" Last round: player {prev.player_move.value}, Tung Tung Tung Sahur {prev.partner_move.value}, "
        f"sentences player {prev.player_years}y / Tung Tung Tung Sahur {prev.partner_years}y."
        if prev
        else ""
    )
    _say(
        session,
        new,
        await _cop(
            session,
            f"INTRO. Round {session.round} of 4. Suspect avatar: {session.avatar.value}.{recap}",
            purpose=f"intro_r{session.round}",
            fallback="Sit down. You and Tung Tung Tung Sahur robbed Sam Altman's GPU vault. Confess and walk free "
            "if Tung Tung Tung Sahur stays quiet. Both quiet: **1 year** each. Both confess: **2 years** each. Your call.",
        ),
    )


# ---------- public actions (each returns a TurnResponse) ----------

async def start_game(avatar: Avatar) -> TurnResponse:
    session = store.create(avatar)
    audit(session.session_id, "session_start", avatar=avatar.value)
    new: list[Message] = []
    await _intro(session, new)
    return TurnResponse(new_messages=new, state=session.view())


async def chat_with_cop(session_id: str, raw_text: str) -> TurnResponse:
    session = store.get(session_id)
    text = clean_player_text(raw_text)
    if not text:
        raise GameError("Say something first.", status=422)
    session.register_cop_message()
    if looks_like_injection(text):
        audit(session.session_id, "injection_attempt", text=text)
    new: list[Message] = []
    _say(session, new, Message(speaker="player", text=text))
    _say(
        session,
        new,
        await _cop(
            session,
            f"CHAT. Round {session.round}. The suspect says: {wrap_player_text(text)}",
            purpose=f"chat_r{session.round}",
            fallback="Nice try. The deal stands. Silent or confess?",
        ),
    )
    return TurnResponse(new_messages=new, state=session.view())


async def play_move(session_id: str, move: Move) -> TurnResponse:
    session = store.get(session_id)
    session.validate_player_move(move)  # wrong phase / locked row / game over → GameError
    new: list[Message] = []
    _say(session, new, Message(speaker="player", text=f"I choose: **{_label(move)}**"))

    # 1) Partner agent picks within the allowed set (guardrail + engine fallback).
    allowed = session.allowed_partner_moves(move)
    deps = GameDeps(session, allowed_partner_moves=allowed)
    overridden = False
    try:
        decision = await run_agent(
            partner_agent,
            f"Round {session.round}. Choose your move. (You can't see the player's choice; just follow the allowed moves.)",
            deps,
            purpose=f"partner_r{session.round}",
        )
        partner_move, partner_line = decision.move, decision.line
    except AGENT_FAILURES as exc:
        partner_move, partner_line, overridden = allowed[0], "Tung Tung Tung Sahur tung tung...!", True
        audit(session.session_id, "partner_override", allowed=[m.value for m in allowed], error=str(exc))
    if partner_move not in allowed:  # belt and braces: the validator should already prevent this
        audit(session.session_id, "partner_override", attempted=partner_move.value)
        partner_move, overridden = allowed[0], True

    result = session.resolve_round(move, partner_move, partner_line=partner_line, overridden=overridden)
    audit(session.session_id, "round_resolved", **result.model_dump(mode="json"))
    _say(session, new, Message(speaker="partner", text=partner_line))

    # 2) Cop announces the engine's verdict.
    verdict = (
        f"VERDICT. Round {result.round}. Player chose {move.value}; Tung Tung Tung Sahur chose {partner_move.value}. "
        f"Sentence: player {result.player_years} years, Tung Tung Tung Sahur {result.partner_years} years."
    )
    _say(
        session,
        new,
        await _cop(
            session,
            verdict,
            purpose=f"verdict_r{result.round}",
            fallback=f"Tung Tung Tung Sahur chose **{_label(partner_move)}**. You get **{result.player_years} years**, "
            f"Tung Tung Tung Sahur gets **{result.partner_years}**. Take them away!",
        ),
    )

    # 3) Tutor opens the matrix and asks for this round's cell.
    cell = f"You: {_label(move)} / Tung Tung Tung Sahur: {_label(partner_move)}"
    _say(
        session,
        new,
        await _tutor(
            session,
            f"ASK_CELL. Round {result.round}. Cell to fill: {cell}.",
            purpose=f"ask_r{result.round}",
            fallback=f"Let's fill in **{cell}**. How many years did you get, and how many did Tung Tung Tung Sahur get?",
        ),
    )
    return TurnResponse(new_messages=new, state=session.view())


async def answer_cell(session_id: str, player_years: int, partner_years: int) -> TurnResponse:
    session = store.get(session_id)
    locked_before = set(session.locked_moves())
    r = session.current
    correct, revealed = session.answer_cell(player_years, partner_years)
    audit(
        session.session_id, "cell_answer", round=r.round, answer=[player_years, partner_years],
        correct=correct, attempt=r.cell_attempts,
    )
    new: list[Message] = []
    _say(session, new, Message(speaker="player", text=f"My years: **{player_years}**, Tung Tung Tung Sahur's: **{partner_years}**"))

    cell = f"You: {_label(r.player_move)} / Tung Tung Tung Sahur: {_label(r.partner_move)}"
    newly_locked = [m for m in session.locked_moves() if m not in locked_before]
    nudge = (
        f" ALSO NUDGE: the player has now seen both outcomes of '{newly_locked[0].value}'; "
        "encourage the other strategy next round."
        if newly_locked and session.phase == Phase.INTERROGATION
        else ""
    )
    lesson = f" Lesson for this cell (teach exactly this): {CELL_LESSONS[(r.player_move, r.partner_move)]}."
    filled = sum(c.revealed for c in session.view().matrix)
    lesson += (
        f" Progress: {filled} of 4 cells filled so far"
        + (f", {4 - filled} still to discover. Do NOT say the matrix is complete." if filled < 4 else ", the matrix is complete.")
    )
    if correct:
        prompt = f"CORRECT. Cell {cell} = ({r.player_years}, {r.partner_years}).{lesson}{nudge}"
        fallback = f"Correct! **{cell}** is ({r.player_years}, {r.partner_years})."
    elif revealed:
        prompt = (
            f"REVEAL. Cell {cell} = ({r.player_years}, {r.partner_years}). "
            f"Player answered ({player_years}, {partner_years}).{lesson}{nudge}"
        )
        fallback = f"The answer for **{cell}** is ({r.player_years}, {r.partner_years}): yours first, then Tung Tung Tung Sahur's."
    else:
        prompt = (
            f"WRONG. Attempt {r.cell_attempts} of 3. Cell {cell}. Player answered ({player_years}, {partner_years}). "
            f"The cop said: player {r.player_years}y, Tung Tung Tung Sahur {r.partner_years}y (do NOT state these numbers)."
        )
        fallback = "Not quite. What did Detective Zhou say each of you got? Your years go first."
    if session.phase == Phase.CHALLENGE:
        # Matrix complete: react to the last cell, then ask the player to name their dominant strategy.
        result_word = "correctly" if correct else "after a reveal"
        prompt = (
            f"CHALLENGE. All 4 cells are now filled (the last one, {cell}, {result_word}; it is "
            f"{CELL_LESSONS[(r.player_move, r.partner_move)]})."
        )
        fallback = (
            "You built the whole matrix! A **dominant strategy** is best for you no matter what the other player does."
        )
    purpose = "challenge" if session.phase == Phase.CHALLENGE else f"feedback_r{r.round}"
    reply = await _tutor(session, prompt, purpose=purpose, fallback=fallback)
    if session.phase == Phase.CHALLENGE:
        reply.text = f"{reply.text.rstrip()}\n\n{CHALLENGE_QUESTION}"
    _say(session, new, reply)

    if session.phase == Phase.INTERROGATION:
        await _intro(session, new)
    return TurnResponse(new_messages=new, correct=correct, state=session.view())


async def ask_tutor(session_id: str, raw_text: str) -> TurnResponse:
    """During the challenge the player may type questions to Nash-sensei (capped)."""
    session = store.get(session_id)
    text = clean_player_text(raw_text)
    if not text:
        raise GameError("Type a question first.", status=422)
    session.register_tutor_question()
    if looks_like_injection(text):
        audit(session.session_id, "injection_attempt", text=text)
    audit(session.session_id, "tutor_question", text=text)
    new: list[Message] = []
    _say(session, new, Message(speaker="player", text=text))
    _say(
        session,
        new,
        await _tutor(
            session,
            f"QUESTION. The student asks: {wrap_player_text(text)}",
            purpose="tutor_question",
            fallback="Look down each column at **your** years: what do you get if he stays silent, and if he confesses?",
        ),
    )
    return TurnResponse(new_messages=new, state=session.view())


async def answer_dominant(session_id: str, move: Move) -> TurnResponse:
    """The player names their dominant strategy. Graded in code; the tutor hints, or debriefs when it's over."""
    session = store.get(session_id)
    correct, revealed = session.answer_dominant(move)
    audit(
        session.session_id, "dominant_answer", move=move.value, correct=correct,
        attempt=session.challenge_attempts, revealed=revealed,
    )
    new: list[Message] = []
    _say(session, new, Message(speaker="player", text=f"My dominant strategy is: **{_label(move)}**"))
    if correct or revealed:
        outcome = "They FOUND it (Confess) on their own." if correct else "They did not find it; reveal that it is Confess."
        prompt, purpose = f"DEBRIEF. {outcome}", "debrief"
        fallback = (
            ("Yes! " if correct else "It's **Confess**. ")
            + "Watch the matrix: confessing gives you fewer years whatever he does (0 < 1, 2 < 3), and the same is "
            "true for him. So (Confess, Confess) is the **Nash equilibrium**, even though (1, 1) is better for both."
        )
    else:
        prompt = f"DOMINANT_WRONG. Attempt {session.challenge_attempts} of 2. They picked {_label(move)}."
        purpose = "dominant_hint"
        fallback = "Not quite. If he stays silent, is 1 year or 0 years better for you? And if he confesses, 3 or 2?"
    _say(session, new, await _tutor(session, prompt, purpose=purpose, fallback=fallback))
    return TurnResponse(new_messages=new, correct=correct, state=session.view())
