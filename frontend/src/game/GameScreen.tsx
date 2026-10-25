// Door 1: Dilemma Detectives. Owns the session; AI lines play out as click-through speech bubbles.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { CameraRig } from "../scenes/CameraAim";
import { ApiError, api } from "../api";
import { Cells } from "../scenes/Cells";
import { Interrogation } from "../scenes/Interrogation";
import { ChatPanel } from "../ui/ChatPanel";
import { PayoffMatrix } from "../ui/PayoffMatrix";
import { SpeechBubble } from "../ui/SpeechBubble";
import { splitPieces } from "./dialogue";
import type { Speaker } from "../scenes/SpeechAnchor";
import type { AvatarId, Message, Move, SessionView, TurnResponse, Usage } from "../types";

type Cam = { position: [number, number, number]; target: [number, number, number]; hfov: number };
const ROOM_CAM: Cam = { position: [3.0, 2.6, 5.0], target: [-1.3, 1.2, -1], hfov: 76 };
const CELLS_CAM: Cam = { position: [0, 3.0, 8.8], target: [0, 0.75, 0], hfov: 62 };

const ROUND_TWIST_TITLES: Record<number, string> = {
  2: "Round 2 · 🧪 The Polygraph",
  3: "Round 3 · 🍩 Good Cop?",
  4: "Round 4 · 🚨 Final Showdown",
};

const isNpc = (m: Message): m is Message & { speaker: Speaker } => m.speaker === "cop" || m.speaker === "partner" || m.speaker === "tutor";

interface Props {
  avatar: AvatarId;
  onExit: () => void;
  /** Present when this player took the before-check; shown once the matrix is complete. */
  onAfterCheck?: (sessionId: string) => void;
}

export function GameScreen({ avatar, onExit, onAfterCheck }: Props) {
  const [view, setView] = useState<SessionView | null>(null);
  const [messages, setMessages] = useState<Message[]>([]); // transcript: lines already shown
  const [queue, setQueue] = useState<(Message & { speaker: Speaker })[]>([]); // AI lines waiting for "Next"
  const [piece, setPiece] = useState(0);
  const [busy, setBusy] = useState(false);
  const [waitingOn, setWaitingOn] = useState<Speaker>("cop");
  const [usage, setUsage] = useState<Usage | null>(null);
  const [wrongPulse, setWrongPulse] = useState(0);
  const [banner, setBanner] = useState<string | null>(null);
  const [toasts, setToasts] = useState<{ id: number; text: string; points: number }[]>([]);
  const pendingAwards = useRef<{ text: string; points: number }[]>([]);
  const knownBadges = useRef<string[]>([]);
  const lastTwistRound = useRef(1);
  const [highlight, setHighlight] = useState(0); // bumps to (re)play the dominant-strategy highlight on the matrix
  const started = useRef(false);

  const current = queue[0];
  const pieces = useMemo(() => (current ? splitPieces(current.text) : []), [current]);

  /** Advance the speech bubble: next piece, or move the finished line into the transcript. */
  const next = useCallback(() => {
    if (!current) return;
    if (piece + 1 < pieces.length) return setPiece(piece + 1);
    setMessages((prev) => [...prev, current]);
    setQueue((q) => q.slice(1));
    setPiece(0);
  }, [current, piece, pieces.length]);

  const run = useCallback(
    async (action: () => Promise<TurnResponse>, speaker: Speaker, optimistic?: Message) => {
      if (optimistic) setMessages((prev) => [...prev, optimistic]);
      setWaitingOn(speaker);
      setBusy(true);
      try {
        const resp = await action();
        const fresh = resp.new_messages.slice(optimistic ? 1 : 0); // server echoes the player's line first
        setMessages((prev) => [...prev, ...fresh.filter((m) => !isNpc(m))]);
        setQueue((q) => [...q, ...fresh.filter(isNpc)]);
        setView(resp.state);
        pendingAwards.current.push(
          ...resp.state.last_awards.map((a) => ({ text: a.reason, points: a.points })),
          ...resp.state.badges.filter((b) => !knownBadges.current.includes(b)).map((b) => ({ text: `🏅 Badge: ${b}`, points: 0 })),
        );
        knownBadges.current = resp.state.badges;
        api.usage(resp.state.session_id).then(setUsage).catch(() => {});
        return resp;
      } catch (e) {
        const text = e instanceof ApiError ? e.message : "Couldn't reach the game server. Is it running?";
        setMessages((prev) => [...prev, { speaker: "system", text: `⚠️ ${text}` }]);
        flash(`⚠️ ${text}`);
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  const start = useCallback(() => {
    setMessages([]);
    setView(null);
    setUsage(null);
    setHighlight(0);
    knownBadges.current = [];
    pendingAwards.current = [];
    lastTwistRound.current = 1;
    setQueue([]);
    setPiece(0);
    run(() => api.newSession(avatar), "cop");
  }, [avatar, run]);

  useEffect(() => {
    if (started.current) return; // StrictMode runs effects twice in dev
    started.current = true;
    start();
  }, [start]);

  const sid = view?.session_id;
  const challenge = view?.phase === "challenge";
  const label = (m: Move) => (m === "silent" ? "Stay Silent" : "Confess");
  const onSend = (text: string) =>
    sid &&
    (challenge
      ? run(() => api.tutor(sid, text), "tutor", { speaker: "player", text })
      : run(() => api.chat(sid, text), "cop", { speaker: "player", text }));
  const onMove = async (m: Move, prediction: Move | null = null) => {
    if (!sid) return;
    if (!challenge) {
      const bet = prediction ? ` · 🔮 I bet he ${prediction === "silent" ? "stayed silent" : "confessed"}` : "";
      run(() => api.move(sid, m, prediction), "cop", { speaker: "player", text: `I choose: **${label(m)}**${bet}` });
      return;
    }
    const resp = await run(() => api.dominant(sid, m), "tutor", {
      speaker: "player",
      text: `My dominant strategy is: **${label(m)}**`,
    });
    if (resp?.state.phase === "complete") {
      flash(resp.correct ? "🎯 You found the dominant strategy!" : "💡 The dominant strategy is Confess");
      setHighlight((n) => n + 1); // play the matrix animation
    } else if (resp?.correct === false) {
      setWrongPulse((n) => n + 1);
    }
  };
  const onCell = async (you: number, them: number) => {
    if (!sid) return;
    const resp = await run(() => api.cell(sid, you, them), "tutor", { speaker: "player", text: `My years: **${you}**, Tung Tung Tung Sahur's: **${them}**` });
    if (resp?.correct === false) setWrongPulse((n) => n + 1);
    if (resp?.correct) flash("✨ Cell unlocked!");
  };

  const bannerTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const flash = (text: string, ms = 2200) => {
    setBanner(text);
    clearTimeout(bannerTimer.current); // a newer banner gets its full time on screen
    bannerTimer.current = setTimeout(() => setBanner(null), ms);
  };

  // Which room we're in follows whoever is talking; otherwise the game phase.
  const talker: Speaker | null = current?.speaker ?? (busy ? waitingOn : null);
  const inRoom = talker ? talker !== "tutor" : !view || view.phase === "interrogation";
  const last = view?.history.at(-1);
  const dialoguePending = queue.length > 0;
  const locked = busy || dialoguePending;

  // Show earned points/badges only once every speech bubble has been read.
  useEffect(() => {
    if (busy || dialoguePending || !pendingAwards.current.length) return;
    const batch = pendingAwards.current.splice(0).map((a, i) => ({ ...a, id: Date.now() + i }));
    setToasts((t) => [...t, ...batch]);
    const ids = batch.map((b) => b.id);
    // not cleared on re-render on purpose: each batch always removes itself after its fade-out
    setTimeout(() => setToasts((t) => t.filter((x) => !ids.includes(x.id))), 3700);
  }, [busy, dialoguePending, view]);

  // Announce each repeat round's twist when we arrive back in the interrogation room.
  useEffect(() => {
    if (!view || !inRoom || view.phase !== "interrogation" || view.round <= lastTwistRound.current) return;
    lastTwistRound.current = view.round;
    flash(ROUND_TWIST_TITLES[view.round] ?? `Round ${view.round}`, 3200);
  }, [inRoom, view]);

  return (
    <div className="game">
      <div className="stage">
        <div className="canvas-wrap">
          <Canvas shadows camera={{ position: ROOM_CAM.position, fov: 52 }}>
            <color attach="background" args={["#05030a"]} />
            <CameraRig {...(inRoom ? ROOM_CAM : CELLS_CAM)} />
            {inRoom ? <Interrogation avatar={avatar} copTalking={talker === "cop"} round={view?.round ?? 1} /> : <Cells avatar={avatar} result={last} />}
          </Canvas>
        </div>

        <div className="hud-top">
          <button className="ghost pill" onClick={onExit}>← Back to the hall</button>
          <span className="pill">
            {inRoom ? "Interrogation room" : view?.phase === "complete" ? "Debrief with Nash-sensei" : "Holding cells"} · Round{" "}
            <b>{view ? Math.min(view.round, view.max_rounds) : 1}</b>/4
          </span>
          {view && (
            <span className="pill score-pill" title="Points: matrix cells, predictions, dominant strategy">
              ⭐ <b>{view.score}</b>
              {view.streak > 1 && <span className="streak"> 🔥×{view.streak}</span>}
            </span>
          )}
        </div>
        <div className="toasts">
          {toasts.map((t) => (
            <div key={t.id} className={`toast ${t.points ? "" : "badge"}`}>
              {t.points ? <b>+{t.points}</b> : null} {t.text}
            </div>
          ))}
        </div>

        {banner && <div className="banner">{banner}</div>}

        {current ? (
          <SpeechBubble
            key={`${messages.length}-${current.speaker}`}
            speaker={current.speaker}
            text={pieces[piece]}
            index={piece}
            total={pieces.length}
            onNext={next}
            lastLabel={queue.length > 1 ? "Next" : "Got it"}
          />
        ) : (
          busy && <SpeechBubble key={`typing-${waitingOn}`} speaker={waitingOn} />
        )}

        {view && !inRoom && (
          <PayoffMatrix
            view={view}
            busy={locked}
            wrongPulse={wrongPulse}
            onSubmit={onCell}
            highlight={highlight}
            onReplay={() => setHighlight((n) => n + 1)}
          />
        )}
        {view?.phase === "complete" && !locked && (
          <div className="hint" style={{ bottom: "auto", top: 64 }}>
            <div className="done-actions">
              <div className="final-score">
                <span>🏆 Final score</span>
                <strong>⭐ {view?.score}</strong>
                <small>best streak 🔥×{view?.best_streak}</small>
                <div className="badge-list">
                  {view?.badges.map((b) => (
                    <span key={b} className="badge-chip" title={b}>
                      {b.split(":")[0]}
                    </span>
                  ))}
                </div>
              </div>
              {onAfterCheck && view ? (
                <>
                  <button className="primary" onClick={() => onAfterCheck(view.session_id)}>Take the after-check →</button>
                  <button className="ghost" onClick={start}>Play again</button>
                </>
              ) : (
                <>
                  <button className="primary" onClick={start}>Play again</button>
                  <button className="ghost" onClick={onExit}>Back to the hall</button>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      <ChatPanel avatar={avatar} messages={messages} view={view} busy={locked} dialoguePending={dialoguePending} usage={usage} onSend={onSend} onMove={onMove} />
    </div>
  );
}

