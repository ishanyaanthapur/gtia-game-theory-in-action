"""Door 3 (The Ultimatum): player actions -> engine updates + agent calls, with canned fallbacks."""
from __future__ import annotations

from pydantic import BaseModel

from backend.agents.base import run_agent
from backend.agents.ultimatum import UltDeps, tung_proposer, tung_responder, ult_sensei
from backend.game.engine import GameError
from backend.game.ultimatum import (
    ALWAYS_ACCEPT_AT,
    CHALLENGE_OPTIONS,
    CHALLENGE_QUESTION,
    POT,
    UltimatumSession,
    UltimatumStore,
    UltimatumView,
    UPhase,
)
from backend.models import Avatar, Message
from backend.orchestrator import AGENT_FAILURES
from backend.safety import clean_player_text, looks_like_injection, screen_player_text, wrap_player_text
from backend.usage import audit

ustore = UltimatumStore()


class UltTurn(BaseModel):
    new_messages: list[Message]
    correct: bool | None = None
    state: UltimatumView


def _say(s: UltimatumSession, new: list[Message], msg: Message) -> None:
    s.messages.append(msg)
    new.append(msg)


async def _sensei(s: UltimatumSession, prompt: str, purpose: str, fallback: str) -> Message:
    try:
        reply = await run_agent(ult_sensei, prompt, UltDeps(s), purpose=purpose)
        return Message(speaker="tutor", text=reply.text)
    except AGENT_FAILURES as exc:
        audit(s.session_id, "agent_fallback", agent="ult_sensei", purpose=purpose, error=str(exc))
        return Message(speaker="tutor", text=fallback)


def _result_line(proposer: str, offer: int, accepted: bool, player_gets: int, tung_gets: int) -> str:
    if not accepted:
        return "❌ **Rejected.** Nobody gets anything this round; the stash goes to Lost Property."
    return f"✅ **Deal!** You get **{player_gets:,}** GPUs; Tung Tung Tung Sahur gets **{tung_gets:,}**."


async def _tung_makes_offer(s: UltimatumSession, new: list[Message]) -> None:
    prompt = f"PROPOSE. Round {s.index + 1} of 4. Pot {POT:,}. History so far: {s.history_text()}"
    try:
        offer = await run_agent(tung_proposer, prompt, UltDeps(s), purpose=f"tung_propose_r{s.index + 1}")
        amount, line = offer.offer_to_player, offer.line
        audit(s.session_id, "agent_output", agent="tung_proposer", output=offer.model_dump())
    except AGENT_FAILURES as exc:
        amount, line = 3_500, "Tung tung tung! Tung Tung Tung Sahur offers 3,500. Take it or leave it!"
        audit(s.session_id, "agent_fallback", agent="tung_proposer", error=str(exc))
    s.tung_proposes(amount)
    _say(s, new, Message(speaker="partner", text=line))
    _say(
        s,
        new,
        Message(
            speaker="system",
            text=f"🤝 **Tung Tung Tung Sahur offers you {amount:,} GPUs** (he keeps {POT - amount:,}). Accept or reject?",
        ),
    )


async def _challenge(s: UltimatumSession, new: list[Message]) -> None:
    reply = await _sensei(
        s,
        f"U_CHALLENGE. History: {s.history_text()} Totals: player {s.player_total:,}, Tung Tung Tung Sahur {s.tung_total:,}.",
        purpose="ult_challenge",
        fallback="All four rounds are done.",
    )
    reply.text = f"{reply.text.rstrip()}\n\n{CHALLENGE_QUESTION}"
    _say(s, new, reply)


# ---------- public actions ----------

async def start(avatar: Avatar) -> UltTurn:
    s = ustore.create(avatar)
    audit(s.session_id, "session_start", game="ultimatum", avatar=avatar.value)
    new: list[Message] = []
    _say(
        s,
        new,
        await _sensei(
            s,
            f"U_INTRO. Player avatar: {avatar.value}.",
            purpose="ult_intro",
            fallback="Welcome to King's Cross! You'll split **10,000 GPUs** with Tung Tung Tung Sahur over 4 rounds. "
            "One proposes, the other accepts or rejects; a rejection means nobody gets anything. You go first: drag the slider.",
        ),
    )
    return UltTurn(new_messages=new, state=s.view())


async def player_offer(session_id: str, offer_to_tung: int) -> UltTurn:
    s = ustore.get(session_id)
    if s.phase != UPhase.PROPOSE or s.proposer != "player":
        raise GameError("It isn't your turn to propose.")
    s.validate_offer(offer_to_tung)  # before spending an AI call
    new: list[Message] = []
    _say(s, new, Message(speaker="player", text=f"I offer Tung Tung Tung Sahur **{offer_to_tung:,}** GPUs (I keep {POT - offer_to_tung:,})."))
    prompt = (
        f"RESPOND. Round {s.index + 1} of 4. The player offers you {offer_to_tung:,} of {POT:,} "
        f"({100 * offer_to_tung // POT}%); they keep {POT - offer_to_tung:,}. History so far: {s.history_text()}"
    )
    try:
        d = await run_agent(tung_responder, prompt, UltDeps(s), purpose=f"tung_respond_r{s.index + 1}")
        accept, line = d.accept, d.line
        audit(s.session_id, "agent_output", agent="tung_responder", output=d.model_dump())
    except AGENT_FAILURES as exc:
        accept = offer_to_tung >= 3_000
        line = "Tung tung tung! Deal." if accept else "Tung tung tung?! That's an insult. REJECTED!"
        audit(s.session_id, "agent_fallback", agent="tung_responder", error=str(exc))
    r = s.player_proposes(offer_to_tung, tung_accepts=accept, tung_line=line)
    if r.overridden:
        audit(s.session_id, "tung_override", reason=f"offers >= {ALWAYS_ACCEPT_AT} are always accepted", offer=offer_to_tung)
    audit(s.session_id, "ult_round", **r.model_dump())
    _say(s, new, Message(speaker="partner", text=line))
    _say(s, new, Message(speaker="system", text=_result_line("player", offer_to_tung, r.accepted, r.player_gets, r.tung_gets)))
    if s.phase == UPhase.CHALLENGE:
        await _challenge(s, new)
    else:
        await _tung_makes_offer(s, new)
    return UltTurn(new_messages=new, correct=r.accepted, state=s.view())


async def player_respond(session_id: str, accept: bool) -> UltTurn:
    s = ustore.get(session_id)
    offer = s.pending_offer_to_player
    reaction = (
        "Tung tung tung! Pleasure doing business, partner."
        if accept
        else "TUNG TUNG TUNG?! You'd rather have NOTHING than take my offer?!"
    )
    r = s.player_responds(accept, tung_line=reaction)
    audit(s.session_id, "ult_round", **r.model_dump())
    new: list[Message] = []
    _say(s, new, Message(speaker="player", text=f"I **{'accept' if accept else 'reject'}** your offer of {offer:,}."))
    _say(s, new, Message(speaker="partner", text=reaction))
    _say(s, new, Message(speaker="system", text=_result_line("tung", offer or 0, r.accepted, r.player_gets, r.tung_gets)))
    if s.phase == UPhase.CHALLENGE:
        await _challenge(s, new)
    else:
        _say(s, new, Message(speaker="system", text=f"🎯 **Round {s.index + 1}: your turn to propose.** Drag the slider."))
    return UltTurn(new_messages=new, correct=accept, state=s.view())


async def ask_sensei(session_id: str, raw_text: str) -> UltTurn:
    s = ustore.get(session_id)
    text = clean_player_text(raw_text)
    if not text:
        raise GameError("Type a question first.", status=422)
    screen_player_text(s.session_id, text, "ult_tutor_question")
    s.register_tutor_question()
    if looks_like_injection(text):
        audit(s.session_id, "injection_attempt", text=text)
    audit(s.session_id, "tutor_question", text=text)
    new: list[Message] = []
    _say(s, new, Message(speaker="player", text=text))
    _say(
        s,
        new,
        await _sensei(
            s,
            f"QUESTION. The student asks: {wrap_player_text(text)}",
            purpose="ult_question",
            fallback="Start at the end: if he rejects, he gets 0. Is any positive offer better than 0?",
        ),
    )
    return UltTurn(new_messages=new, state=s.view())


async def answer_challenge(session_id: str, choice: int) -> UltTurn:
    s = ustore.get(session_id)
    correct, revealed = s.answer_challenge(choice)
    audit(s.session_id, "ult_challenge", choice=choice, correct=correct, attempt=s.challenge_attempts, revealed=revealed)
    new: list[Message] = []
    _say(s, new, Message(speaker="player", text=f"My answer: **{CHALLENGE_OPTIONS[choice]}**"))
    if correct or revealed:
        outcome = "They FOUND it (500, the smallest offer above zero)." if correct else "They did not find it; reveal it (500)."
        prompt = (
            f"U_DEBRIEF. {outcome} History: {s.history_text()} "
            f"Totals: player {s.player_total:,}, Tung Tung Tung Sahur {s.tung_total:,}."
        )
        fallback = (
            "A purely GPU-maximizing responder accepts any offer above zero, so backward induction predicts "
            "**(9,500, 500)**. Real people reject unfair offers to punish greed: **the threat of rejection gives the "
            "responder power**."
        )
        _say(s, new, await _sensei(s, prompt, purpose="ult_debrief", fallback=fallback))
        audit(s.session_id, "game_complete", game="ultimatum", player_total=s.player_total, tung_total=s.tung_total,
              challenge_found=s.challenge_found)
    else:
        _say(
            s,
            new,
            await _sensei(
                s,
                f"U_WRONG. Attempt {s.challenge_attempts} of 2. They chose: {CHALLENGE_OPTIONS[choice]}.",
                purpose="ult_hint",
                fallback="Not quite. If he rejects, he gets 0 GPUs. Is 500 better than 0?",
            ),
        )
    return UltTurn(new_messages=new, correct=correct, state=s.view())
