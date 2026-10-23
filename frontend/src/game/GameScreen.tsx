// Door 1: Dilemma Detectives. Owns the session and paces the AI messages for drama.
import { useCallback, useEffect, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { CameraRig } from "../scenes/CameraAim";
import { ApiError, api } from "../api";
import { Cells } from "../scenes/Cells";
import { Interrogation } from "../scenes/Interrogation";
import { ChatPanel } from "../ui/ChatPanel";
import { PayoffMatrix } from "../ui/PayoffMatrix";
import type { AvatarId, Message, Move, SessionView, TurnResponse, Usage } from "../types";

type Cam = { position: [number, number, number]; target: [number, number, number] };
const ROOM_CAM: Cam = { position: [2.9, 2.6, 4.9], target: [-0.9, 1.25, -1] };
const CELLS_CAM: Cam = { position: [0, 3.0, 8.8], target: [0, 0.75, 0] };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function GameScreen({ avatar, onExit }: { avatar: AvatarId; onExit: () => void }) {
  const [view, setView] = useState<SessionView | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [busy, setBusy] = useState(false);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [wrongPulse, setWrongPulse] = useState(0);
  const [banner, setBanner] = useState<string | null>(null);
  const started = useRef(false);

  /** Reveal a turn's messages one at a time; switch scenes when the new scene's speaker talks. */
  const playOut = useCallback(async (resp: TurnResponse, skip = 0) => {
    const sceneSpeaker = resp.state.phase === "interrogation" ? "cop" : "tutor";
    let switched = false;
    const msgs = resp.new_messages.slice(skip);
    for (let i = 0; i < msgs.length; i++) {
      const m = msgs[i];
      if (!switched && m.speaker === sceneSpeaker) {
        setView(resp.state);
        switched = true;
      }
      if (i > 0) await sleep(Math.min(1400, 450 + m.text.length * 4));
      setMessages((prev) => [...prev, m]);
    }
    setView(resp.state);
    api.usage(resp.state.session_id).then(setUsage).catch(() => {});
  }, []);

  const run = useCallback(
    async (action: () => Promise<TurnResponse>, optimistic?: Message) => {
      if (optimistic) setMessages((prev) => [...prev, optimistic]);
      setBusy(true);
      try {
        const resp = await action();
        await playOut(resp, optimistic ? 1 : 0); // server echoes the player's message first
        return resp;
      } catch (e) {
        const text = e instanceof ApiError ? e.message : "Couldn't reach the game server. Is it running?";
        setMessages((prev) => [...prev, { speaker: "system", text: `⚠️ ${text}` }]);
      } finally {
        setBusy(false);
      }
    },
    [playOut],
  );

  const start = useCallback(() => {
    setMessages([]);
    setView(null);
    setUsage(null);
    run(() => api.newSession(avatar));
  }, [avatar, run]);

  useEffect(() => {
    if (started.current) return; // StrictMode runs effects twice in dev
    started.current = true;
    start();
  }, [start]);

  const sid = view?.session_id;
  const onSend = (text: string) => sid && run(() => api.chat(sid, text), { speaker: "player", text });
  const onMove = (m: Move) =>
    sid &&
    run(() => api.move(sid, m), { speaker: "player", text: `I choose: **${m === "silent" ? "Stay Silent" : "Confess"}**` }).then(
      (resp) => {
        const r = resp?.state.history.at(-1);
        if (r) flash(r.player_years === 0 ? "🎉 You walk free!" : `🔒 ${r.player_years} year${r.player_years > 1 ? "s" : ""} for you`);
      },
    );
  const onCell = async (you: number, them: number) => {
    if (!sid) return;
    const resp = await run(() => api.cell(sid, you, them), { speaker: "player", text: `My years: **${you}**, Tung Tung's: **${them}**` });
    if (resp?.correct === false) setWrongPulse((n) => n + 1);
    if (resp?.correct) flash("✨ Cell unlocked!");
  };

  const flash = (text: string) => {
    setBanner(text);
    setTimeout(() => setBanner(null), 2200);
  };

  const inRoom = !view || view.phase === "interrogation";
  const last = view?.history.at(-1);

  return (
    <div className="game">
      <div className="stage">
        <div className="canvas-wrap">
          <Canvas shadows camera={{ position: ROOM_CAM.position, fov: 52 }}>
            <color attach="background" args={["#05030a"]} />
            <CameraRig {...(inRoom ? ROOM_CAM : CELLS_CAM)} />
            {inRoom ? <Interrogation avatar={avatar} copTalking={busy} /> : <Cells avatar={avatar} result={last} />}
          </Canvas>
        </div>

        <div className="hud-top">
          <button className="ghost pill" onClick={onExit}>← Back to the hall</button>
          <span className="pill">
            {inRoom ? "Interrogation room" : view?.phase === "complete" ? "Debrief with Nash-sensei" : "Holding cells"} · Round{" "}
            <b>{view ? Math.min(view.round, view.max_rounds) : 1}</b>/4
          </span>
        </div>

        {banner && <div className="banner">{banner}</div>}

        {view && view.phase !== "interrogation" && (
          <PayoffMatrix view={view} busy={busy} wrongPulse={wrongPulse} onSubmit={onCell} />
        )}
        {view?.phase === "complete" && !busy && (
          <div className="hint" style={{ bottom: "auto", top: 64 }}>
            <div className="done-actions">
              <span style={{ color: "var(--text)", alignSelf: "center" }}>🏆 Matrix complete!</span>
              <button className="primary" onClick={start}>Play again</button>
              <button className="ghost" onClick={onExit}>Back to the hall</button>
            </div>
          </div>
        )}
      </div>

      <ChatPanel avatar={avatar} messages={messages} view={view} busy={busy} usage={usage} onSend={onSend} onMove={onMove} />
    </div>
  );
}

