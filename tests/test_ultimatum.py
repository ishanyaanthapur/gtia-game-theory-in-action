"""Door 3: The Ultimatum, engine rules + API flow with a fake model (no API key, no cost)."""
import json

import pytest
from fastapi.testclient import TestClient
from pydantic_ai.messages import ModelResponse, ToolCallPart
from pydantic_ai.models.function import AgentInfo, FunctionModel

from backend import usage
from backend.agents import base
from backend.game.engine import GameError
from backend.game.ultimatum import ALWAYS_ACCEPT_AT, CHALLENGE_QUESTION, POT, UltimatumSession, UPhase
from backend.main import app
from backend.models import Avatar


# ---------- engine ----------

def test_accepted_offer_splits_the_pot_and_rejection_pays_nothing():
    s = UltimatumSession(avatar=Avatar.KIMCHI)
    r = s.player_proposes(3_000, tung_accepts=True)
    assert (r.player_gets, r.tung_gets) == (7_000, 3_000)
    s.tung_proposes(2_000)
    r2 = s.player_responds(False)
    assert (r2.player_gets, r2.tung_gets) == (0, 0)
    assert s.player_total == 7_000 and s.tung_total == 3_000


def test_even_split_is_never_rejected_guardrail():
    s = UltimatumSession(avatar=Avatar.KIMCHI)
    r = s.player_proposes(ALWAYS_ACCEPT_AT, tung_accepts=False)
    assert r.accepted and r.overridden


@pytest.mark.parametrize("bad", [-500, 10_500, 1_234])
def test_illegal_offers_rejected(bad):
    s = UltimatumSession(avatar=Avatar.KIMCHI)
    with pytest.raises(GameError):
        s.player_proposes(bad, tung_accepts=True)


def test_turn_order_and_challenge_after_four_rounds():
    s = UltimatumSession(avatar=Avatar.YOSHI)
    with pytest.raises(GameError):
        s.tung_proposes(3_000)  # player goes first
    s.player_proposes(4_000, tung_accepts=True)
    with pytest.raises(GameError):
        s.player_proposes(4_000, tung_accepts=True)  # now Tung Tung Tung Sahur's turn
    s.tung_proposes(3_000)
    s.player_responds(True)
    s.player_proposes(1_000, tung_accepts=False)
    s.tung_proposes(4_500)
    s.player_responds(True)
    assert s.phase == UPhase.CHALLENGE
    assert s.answer_challenge(2) == (False, False)
    assert s.answer_challenge(0) == (True, False)
    assert s.phase == UPhase.COMPLETE and s.challenge_found is True


# ---------- API with a fake model ----------

def fake_ultimatum_llm(offer_to_player: int = 3_500, accept_threshold: int = 3_000):
    def respond(messages, info: AgentInfo) -> ModelResponse:
        tool = info.output_tools[0]
        props = tool.parameters_json_schema.get("properties", {})
        prompt = " ".join(str(getattr(p, "content", "")) for m in messages for p in getattr(m, "parts", []))
        if "accept" in props:
            offered = int(prompt.split("offers you ")[1].split(" of")[0].replace(",", ""))
            args = {"accept": offered >= accept_threshold, "line": "tung tung tung", "reasoning": "test"}
        elif "offer_to_player" in props:
            args = {"offer_to_player": offer_to_player, "line": "tung tung tung", "reasoning": "test"}
        else:
            args = {"text": "Sensei line."}
        return ModelResponse(parts=[ToolCallPart(tool.name, json.dumps(args))])

    return FunctionModel(respond)


@pytest.fixture
def client(monkeypatch, tmp_path):
    monkeypatch.setattr(usage, "TOKEN_LOG", tmp_path / "tokens.jsonl")
    monkeypatch.setattr(usage, "AUDIT_LOG", tmp_path / "audit.jsonl")
    monkeypatch.setattr(base, "get_model", lambda: fake_ultimatum_llm())
    c = TestClient(app)
    c.tmp_path = tmp_path
    return c


def test_full_ultimatum_game(client):
    st = client.post("/api/ultimatum", json={"avatar": "jujubee"}).json()["state"]
    sid = st["session_id"]
    assert sid.startswith("u") and st["phase"] == "propose" and st["proposer"] == "player"

    t = client.post(f"/api/ultimatum/{sid}/offer", json={"offer_to_tung": 1_000}).json()
    assert t["state"]["rounds"][0]["accepted"] is False          # 10% offer rejected by fake Tung
    assert t["state"]["phase"] == "respond" and t["state"]["pending_offer_to_player"] == 3_500

    t = client.post(f"/api/ultimatum/{sid}/respond", json={"accept": True}).json()
    assert t["state"]["player_total"] == 3_500 and t["state"]["proposer"] == "player"

    t = client.post(f"/api/ultimatum/{sid}/offer", json={"offer_to_tung": 4_000}).json()
    assert t["state"]["rounds"][2]["accepted"] is True
    t = client.post(f"/api/ultimatum/{sid}/respond", json={"accept": False}).json()
    assert t["state"]["phase"] == "challenge"
    assert t["new_messages"][-1]["text"].endswith(CHALLENGE_QUESTION)

    assert client.post(f"/api/ultimatum/{sid}/tutor", json={"message": "hint?"}).status_code == 200
    t = client.post(f"/api/ultimatum/{sid}/answer", json={"choice": 0}).json()
    assert t["correct"] is True and t["state"]["phase"] == "complete"
    assert t["state"]["player_total"] == 3_500 + 6_000 and t["state"]["tung_total"] == 6_500 + 4_000
    assert '"game": "ultimatum"' in (client.tmp_path / "audit.jsonl").read_text()


def test_api_rejects_bad_offers_and_wrong_turns(client):
    sid = client.post("/api/ultimatum", json={"avatar": "yoshi"}).json()["state"]["session_id"]
    assert client.post(f"/api/ultimatum/{sid}/offer", json={"offer_to_tung": 1_234}).status_code == 422
    assert client.post(f"/api/ultimatum/{sid}/offer", json={"offer_to_tung": 20_000}).status_code == 422
    assert client.post(f"/api/ultimatum/{sid}/respond", json={"accept": True}).status_code == 409
    assert client.post(f"/api/ultimatum/{sid}/answer", json={"choice": 0}).status_code == 409


def test_tung_illegal_offer_gets_retried_then_falls_back(client, monkeypatch):
    monkeypatch.setattr(base, "get_model", lambda: fake_ultimatum_llm(offer_to_player=1_234))
    sid = client.post("/api/ultimatum", json={"avatar": "yoshi"}).json()["state"]["session_id"]
    t = client.post(f"/api/ultimatum/{sid}/offer", json={"offer_to_tung": 5_000}).json()
    pending = t["state"]["pending_offer_to_player"]
    assert pending % 500 == 0 and 0 <= pending <= POT  # validator rejected 1,234; code fallback used
    assert "agent_fallback" in (client.tmp_path / "audit.jsonl").read_text()
