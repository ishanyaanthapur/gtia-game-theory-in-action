import json

import pytest
from fastapi.testclient import TestClient

from backend import usage
from backend.game.quiz import QUESTIONS
from backend.main import app

PID = "test-participant-1"
RIGHT = [q.answer for q in QUESTIONS]


@pytest.fixture
def client(monkeypatch, tmp_path):
    monkeypatch.setattr(usage, "STUDY_LOG", tmp_path / "study.jsonl")
    c = TestClient(app)
    c.tmp_path = tmp_path
    return c


def submit(client, **overrides):
    body = {"participant_id": PID, "phase": "pre", "answers": [None] * 5, "confidence": 2, **overrides}
    return client.post("/api/quiz", json=body)


def test_questions_never_leak_answers(client):
    qs = client.get("/api/quiz").json()["questions"]
    assert len(qs) == 5
    assert all("answer" not in q and "explanation" not in q for q in qs)


def test_pre_then_post_reports_learning_gain(client):
    pre = submit(client, answers=[1, None, 0, 0, None]).json()
    assert pre["score"] == 1 and pre["pre_score"] is None
    post = submit(client, phase="post", answers=RIGHT, confidence=5, rating=4, feedback="Loved Tung Tung Tung Sahur", consent_quote=True).json()
    assert post["score"] == 5 and post["pre_score"] == 1 and post["pre_confidence"] == 2
    rows = [json.loads(line) for line in (client.tmp_path / "study.jsonl").read_text().splitlines()]
    assert [r["phase"] for r in rows] == ["pre", "post"]
    assert rows[1]["feedback"] == "Loved Tung Tung Tung Sahur" and rows[1]["consent_quote"] is True


def test_invalid_option_index_rejected(client):
    assert submit(client, answers=[9, 0, 0, 0, 0]).status_code == 422


def test_wrong_number_of_answers_rejected(client):
    assert submit(client, answers=[0, 0]).status_code == 422


def test_participant_id_must_be_anonymous_token(client):
    assert submit(client, participant_id="Jane Doe <script>").status_code == 422


def test_feedback_is_cleaned_and_capped(client):
    r = submit(client, phase="post", rating=3, feedback="<b>hi</b>" + "x" * 600)
    assert r.status_code == 422  # over 500 chars
    submit(client, phase="post", rating=3, feedback="<b>hi</b>")
    row = json.loads((client.tmp_path / "study.jsonl").read_text().splitlines()[-1])
    assert "<" not in row["feedback"]
