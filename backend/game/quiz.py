"""Before/after understanding check (pre-test / post-test) for the Impact section.

Before Door 1 the player answers ONE question, rotated so every question gets asked about equally
often. After the debrief they answer all 5. Learning gain = the pre-asked question, before vs
after, for the same player. Graded in code; no LLM calls, no token cost.
"""
from __future__ import annotations

from pydantic import BaseModel

from backend.game.payoffs import PAYOFFS, Move

# v1: after-check without the payoff matrix (tester #1, Oct 24). v2: after-check shows the full matrix.
CHECK_VERSION = 2

SCENARIO = (
    "You and a partner are arrested and questioned in separate rooms. Each of you can STAY SILENT or "
    "CONFESS. If you confess and your partner stays silent, you go free (0 years) and they get 3 years "
    "(and vice versa). If you both stay silent, you each get 1 year. If you both confess, you each get 2 years."
)


class Question(BaseModel):
    id: str
    concept: str
    prompt: str
    options: list[str]
    answer: int  # index into options; never sent to the browser before grading
    explanation: str


QUESTIONS: list[Question] = [
    Question(
        id="q1_silent_partner",
        concept="Best response",
        prompt="If your partner STAYS SILENT, what is better for you?",
        options=["Stay silent (1 year)", "Confess (0 years)", "It makes no difference"],
        answer=1,
        explanation="0 years beats 1 year, so confessing is better when your partner stays silent.",
    ),
    Question(
        id="q2_confess_partner",
        concept="Best response",
        prompt="If your partner CONFESSES, what is better for you?",
        options=["Confess (2 years)", "Stay silent (3 years)", "It makes no difference"],
        answer=0,
        explanation="2 years beats 3 years, so confessing is better when your partner confesses too.",
    ),
    Question(
        id="q3_dominant",
        concept="Dominant strategy",
        prompt="What is a dominant strategy?",
        options=[
            "The strategy that gives both players the best total outcome",
            "The strategy the other player is most likely to choose",
            "Always cooperating with your partner",
            "A strategy that is best for you no matter what the other player does",
        ],
        answer=3,
        explanation="A dominant strategy beats your other options whatever the other player does. Here, that's confessing.",
    ),
    Question(
        id="q4_nash",
        concept="Nash equilibrium",
        prompt="Which outcome is the Nash equilibrium (where neither player wants to change their choice alone)?",
        options=["Both stay silent", "One confesses, one stays silent", "Both confess", "There isn't one"],
        answer=2,
        explanation="At (Confess, Confess), switching to silent alone would raise your sentence from 2 to 3, so no one wants to move.",
    ),
    Question(
        id="q5_dilemma",
        concept="Why it's a dilemma",
        prompt="Why is the Prisoner's Dilemma called a 'dilemma'?",
        options=[
            "Each player's individually best choice leads to an outcome that is worse for both than cooperating",
            "The players can't talk, so they have to guess randomly",
            "The police always win no matter what",
            "There is no best strategy for either player",
        ],
        answer=0,
        explanation="Both confessing (2, 2) is stable, yet both staying silent (1, 1) would be better for both.",
    ),
]


BY_ID = {q.id: q for q in QUESTIONS}


def public_questions(ids: list[str] | None = None) -> list[dict]:
    """Questions as sent to the browser (no answers or explanations)."""
    chosen = [BY_ID[i] for i in ids] if ids else QUESTIONS
    return [q.model_dump(include={"id", "concept", "prompt", "options"}) for q in chosen]


def pick_pre_question(times_asked: dict[str, int]) -> str:
    """Rotate: the question asked least often so far in pre-checks (ties go in list order)."""
    return min(QUESTIONS, key=lambda q: times_asked.get(q.id, 0)).id


def grade(answers: dict[str, int | None]) -> tuple[int, list[dict]]:
    """Grade the questions that were asked (in the standard question order)."""
    results = []
    for q in QUESTIONS:
        if q.id not in answers:
            continue
        a = answers[q.id]
        results.append(
            {
                "id": q.id,
                "concept": q.concept,
                "chosen": a,
                "answer": q.answer,
                "correct": a == q.answer,
                "explanation": q.explanation,
            }
        )
    return sum(r["correct"] for r in results), results


def payoff_table() -> dict:
    """The full matrix, shown on the after-check (v2+). Years in jail as (you, partner); lower is better."""
    label = {Move.SILENT: "Stay silent", Move.CONFESS: "Confess"}
    return {
        "rows": [label[m] for m in Move],
        "cols": [label[m] for m in Move],
        "cells": [[list(PAYOFFS[(r, c)]) for c in Move] for r in Move],
    }
