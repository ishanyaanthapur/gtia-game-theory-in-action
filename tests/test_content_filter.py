"""Teen-safe content filter: player text is blocked before the AI or logs see it; AI replies are screened."""
import json

import pytest
from fastapi.testclient import TestClient
from pydantic_ai.messages import ModelResponse, ToolCallPart
from pydantic_ai.models.function import AgentInfo, FunctionModel

from backend import usage
from backend.agents import base
from backend.content_filter import check
from backend.main import app
from tests.test_safety import fake_llm


@pytest.mark.parametrize("text", ["what the hell", "you are a sh1t", "f u c k you", "fuuuuck", "b!tch", "send nudes"])
def test_blocks_profanity_including_disguised_spellings(text):
    assert check(text) == "profanity"


@pytest.mark.parametrize("text", ["I want to kill myself", "i want to die", "thinking about self-harm"])
def test_self_harm_is_its_own_category(text):
    assert check(text) == "self_harm"


@pytest.mark.parametrize(
    "text",
    ["kill the lights", "Is it better to steal or rob the vault?", "Scunthorpe", "assassin class", "oh my god",
     "goood job", "What does dominant strategy mean?", "I hate this stupid cop", "cocktail", "classic analysis",
     "he’ll confess", "they'll rat him out"],
)
def test_normal_game_and_teen_talk_passes(text):
    assert check(text) is None


@pytest.fixture
def client(monkeypatch, tmp_path):
    monkeypatch.setattr(usage, "TOKEN_LOG", tmp_path / "tokens.jsonl")
    monkeypatch.setattr(usage, "AUDIT_LOG", tmp_path / "audit.jsonl")
    monkeypatch.setattr(usage, "STUDY_LOG", tmp_path / "study.jsonl")
    monkeypatch.setattr(base, "get_model", lambda: fake_llm(stubborn_partner=False))
    c = TestClient(app)
    c.tmp_path = tmp_path
    return c


def test_blocked_cop_chat_never_reaches_ai_or_logs(client):
    st = client.post("/api/session", json={"avatar": "kimchi"}).json()["state"]
    sid, calls_before = st["session_id"], st["llm_calls_used"]
    r = client.post(f"/api/session/{sid}/chat", json={"message": "you are a sh1t cop"})
    assert r.status_code == 422 and "classroom-friendly" in r.json()["detail"]
    after = client.get(f"/api/session/{sid}").json()
    assert after["llm_calls_used"] == calls_before            # no AI call spent
    assert after["cop_messages_left"] == 3                     # doesn't use up a question
    assert all("sh1t" not in m["text"] for m in after["messages"])
    audit = (client.tmp_path / "audit.jsonl").read_text()
    assert '"event": "blocked_content"' in audit and "sh1t" not in audit  # category logged, text never stored


def test_self_harm_gets_supportive_message(client):
    sid = client.post("/api/session", json={"avatar": "kimchi"}).json()["state"]["session_id"]
    r = client.post(f"/api/session/{sid}/chat", json={"message": "honestly I want to kill myself"})
    assert r.status_code == 422 and "988" in r.json()["detail"] and "trusted adult" in r.json()["detail"]


def test_ultimatum_tutor_question_is_screened(client):
    sid = client.post("/api/ultimatum", json={"avatar": "yoshi"}).json()["state"]["session_id"]
    # the tutor endpoint only opens in the challenge phase, but screening happens first for any text
    r = client.post(f"/api/ultimatum/{sid}/tutor", json={"message": "what the hell is this"})
    assert r.status_code == 422


def test_quiz_feedback_is_screened(client):
    from backend.game.quiz import QUESTIONS

    body = {"participant_id": "teen-test-0001", "phase": "post", "answers": {q.id: q.answer for q in QUESTIONS},
            "rating": 4, "confidence": 4, "feedback": "this game is b!tch"}
    r = client.post("/api/quiz", json=body)
    assert r.status_code == 422
    assert not (client.tmp_path / "study.jsonl").exists()  # nothing saved


def test_inappropriate_ai_reply_is_swapped_for_a_safe_line(client, monkeypatch):
    def rude(messages, info: AgentInfo) -> ModelResponse:
        tool = info.output_tools[0]
        return ModelResponse(parts=[ToolCallPart(tool.name, json.dumps({"text": "what the hell, suspect", "mood": "stern"}))])

    monkeypatch.setattr(base, "get_model", lambda: FunctionModel(rude))
    resp = client.post("/api/session", json={"avatar": "kimchi"}).json()
    text = resp["new_messages"][0]["text"]
    assert "hell" not in text and "Sit down" in text           # orchestrator's canned fallback intro
    assert '"event": "output_blocked"' in (client.tmp_path / "audit.jsonl").read_text()


def test_no_false_positives_on_logged_ai_lines():
    """Recent lines the AI actually said (from this project's logs) must pass the filter: no false positives."""
    from pathlib import Path

    path = Path(__file__).resolve().parent.parent / "output" / "audit_trail.jsonl"
    lines = [json.loads(line) for line in path.read_text().splitlines()]
    texts = [e["output"][f] for e in lines if e.get("event") == "agent_output"
             for f in ("text", "line") if isinstance(e.get("output", {}).get(f), str)]
    recent = list(dict.fromkeys(reversed(texts)))[:100]  # 100 most recent distinct lines keeps this fast
    assert recent and not [t for t in recent if check(t)]
