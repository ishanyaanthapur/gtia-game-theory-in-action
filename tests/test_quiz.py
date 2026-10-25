import json

import pytest
from fastapi.testclient import TestClient

from backend import usage
from backend.game.quiz import QUESTIONS
from backend.main import app

PID = "test-participant-1"
RIGHT = {q.id: q.answer for q in QUESTIONS}


@pytest.fixture
def client(monkeypatch, tmp_path):
    monkeypatch.setattr(usage, "STUDY_LOG", tmp_path / "study.jsonl")
    c = TestClient(app)
    c.tmp_path = tmp_path
    return c


def rows(client):
    return [json.loads(line) for line in (client.tmp_path / "study.jsonl").read_text().splitlines()]


def pre_question(client) -> str:
    qs = client.get("/api/quiz", params={"phase": "pre"}).json()["questions"]
    assert len(qs) == 1
    return qs[0]["id"]


def test_questions_never_leak_answers(client):
    qs = client.get("/api/quiz", params={"phase": "post"}).json()["questions"]
    assert len(qs) == 5
    assert all("answer" not in q and "explanation" not in q for q in qs)


def test_pre_check_rotates_through_all_questions(client):
    seen = []
    for i in range(len(QUESTIONS)):
        qid = pre_question(client)
        seen.append(qid)
        client.post("/api/quiz", json={"participant_id": f"rot-{i:04d}", "phase": "pre", "answers": {qid: None}})
    assert sorted(seen) == sorted(RIGHT)  # each question asked exactly once before any repeats


def test_pre_then_post_links_the_same_question(client):
    qid = pre_question(client)
    wrong = (RIGHT[qid] + 1) % 3
    pre = client.post("/api/quiz", json={"participant_id": PID, "phase": "pre", "answers": {qid: wrong}}).json()
    assert pre["score"] == 0 and pre["total"] == 1
    post = client.post(
        "/api/quiz",
        json={"participant_id": PID, "phase": "post", "answers": RIGHT, "confidence": 5, "rating": 4,
              "feedback": "Loved Tung Tung Tung Sahur", "consent_quote": True},
    ).json()
    assert post["score"] == 5
    assert post["pre"]["question_id"] == qid
    assert post["pre"]["correct_before"] is False and post["pre"]["correct_after"] is True
    r = rows(client)
    assert [x["phase"] for x in r] == ["pre", "post"]
    assert r[0]["asked"] == [qid] and r[0]["confidence"] is None
    assert r[1]["feedback"] == "Loved Tung Tung Tung Sahur" and r[1]["consent_quote"] is True


def test_pre_check_must_be_exactly_one_question(client):
    r = client.post("/api/quiz", json={"participant_id": PID, "phase": "pre", "answers": RIGHT})
    assert r.status_code == 422


def test_post_check_must_answer_all_five(client):
    r = client.post("/api/quiz", json={"participant_id": PID, "phase": "post", "answers": {QUESTIONS[0].id: 1}})
    assert r.status_code == 422


def test_unknown_question_or_option_rejected(client):
    assert client.post("/api/quiz", json={"participant_id": PID, "phase": "pre", "answers": {"made_up": 0}}).status_code == 422
    assert client.post("/api/quiz", json={"participant_id": PID, "phase": "pre", "answers": {QUESTIONS[0].id: 9}}).status_code == 422


def test_participant_id_must_be_anonymous_token(client):
    r = client.post("/api/quiz", json={"participant_id": "Jane Doe <script>", "phase": "pre", "answers": {QUESTIONS[0].id: 0}})
    assert r.status_code == 422


def test_feedback_is_cleaned_and_capped(client):
    body = {"participant_id": PID, "phase": "post", "answers": RIGHT, "rating": 3}
    assert client.post("/api/quiz", json={**body, "feedback": "x" * 600}).status_code == 422
    client.post("/api/quiz", json={**body, "feedback": "<b>hi</b>"})
    assert "<" not in rows(client)[-1]["feedback"]


def test_after_check_shows_matrix_but_before_check_does_not(client):
    pre = client.get("/api/quiz", params={"phase": "pre"}).json()
    post = client.get("/api/quiz", params={"phase": "post"}).json()
    assert pre["matrix"] is None
    assert post["matrix"]["cells"] == [[[1, 1], [3, 0]], [[0, 3], [2, 2]]]


def test_rows_are_tagged_with_check_version(client):
    qid = pre_question(client)
    client.post("/api/quiz", json={"participant_id": PID, "phase": "pre", "answers": {qid: None}})
    assert rows(client)[0]["check_version"] == 3


def test_answer_options_never_give_away_the_payoffs(client):
    for phase in ("pre", "post"):
        for q in client.get("/api/quiz", params={"phase": phase}).json()["questions"]:
            assert not any(ch.isdigit() for opt in q["options"] for ch in opt), q["options"]


def test_after_check_scenario_has_no_numbers(client):
    scenario = client.get("/api/quiz", params={"phase": "post"}).json()["scenario"]
    assert not any(ch.isdigit() for ch in scenario)


def test_preview_submissions_are_graded_but_not_saved(client):
    r = client.post("/api/quiz", json={"participant_id": PID, "phase": "post", "answers": RIGHT, "preview": True})
    assert r.status_code == 200 and r.json()["score"] == 5
    assert not (client.tmp_path / "study.jsonl").exists()
