// Door 3: The Ultimatum at King's Cross. Same click-through dialogue as Door 1; results appear as a
// centered card, and the side panel holds the offer slider, accept/reject, and the backward-induction challenge.
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { audio } from "../audio/engine";
import { Canvas } from "@react-three/fiber";
import Markdown from "react-markdown";
import { ApiError, api } from "../api";
import { AVATARS } from "../characters/avatars";
import { CameraRig } from "../scenes/CameraAim";
import { KingsCross } from "../scenes/KingsCross";
import type { Speaker } from "../scenes/SpeechAnchor";
import { SpeechBubble } from "../ui/SpeechBubble";
import { splitPieces } from "./dialogue";
import type { AvatarId, Message, UltTurn, UltimatumView } from "../types";

const CAM = { position: [0, 2.4, 7.2] as [number, number, number], target: [0.6, 1.1, 0] as [number, number, number], hfov: 70 };
const NAMES: Record<Message["speaker"], string> = {
  cop: "Detective Zhou",
  partner: "Tung Tung Tung Sahur",
  tutor: "Nash-sensei",
  player: "You",
  system: "Result",
};
type Queued = Message & { speaker: Speaker | "system" };
const fmt = (n: number) => n.toLocaleString();

export function UltimatumScreen({ avatar, onExit }: { avatar: AvatarId; onExit: () => void }) {
  const [view, setView] = useState<UltimatumView | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [queue, setQueue] = useState<Queued[]>([]);
  const [piece, setPiece] = useState(0);
  const [busy, setBusy] = useState(false);
  const [waitingOn, setWaitingOn] = useState<Speaker>("tutor");
  const [offer, setOffer] = useState(4000);
  const [draft, setDraft] = useState("");
  const started = useRef(false);

  const current = queue[0];
  const pieces = useMemo(() => (current && current.speaker !== "system" ? splitPieces(current.text) : []), [current]);

  const next = useCallback(() => {
    if (!current) return;
    audio.sfx("tick");
    if (current.speaker !== "system" && piece + 1 < pieces.length) return setPiece(piece + 1);
    setMessages((m) => [...m, current]);
    setQueue((q) => q.slice(1));
    setPiece(0);
  }, [current, piece, pieces.length]);

  const run = useCallback(async (action: () => Promise<UltTurn>, speaker: Speaker, mine?: Message) => {
    if (mine) setMessages((m) => [...m, mine]);
    setWaitingOn(speaker);
    setBusy(true);
    try {
      const resp = await action();
      const fresh = resp.new_messages.slice(mine ? 1 : 0);
      setMessages((m) => [...m, ...fresh.filter((x) => x.speaker === "player")]);
      setQueue((q) => [...q, ...(fresh.filter((x) => x.speaker !== "player") as Queued[])]);
      setView(resp.state);
      return resp;
    } catch (e) {
      const text = e instanceof ApiError ? e.message : "Couldn't reach the game server. Is it running?";
      setMessages((m) => [...m, { speaker: "system", text: `⚠️ ${text}` }]);
    } finally {
      setBusy(false);
    }
  }, []);

  const start = useCallback(() => {
    setMessages([]);
    setQueue([]);
    setPiece(0);
    setView(null);
    setOffer(4000);
    run(() => api.ultStart(avatar), "tutor");
  }, [avatar, run]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    start();
  }, [start]);

  // Leitmotif when a new character speaks; a sound for each result card.
  const lastSpeaker = useRef<string | null>(null);
  useEffect(() => {
    if (!current) return;
    if (current.speaker === "system") {
      const t = current.text;
      audio.sfx(t.startsWith("✅") ? "deal" : t.startsWith("❌") ? "reject" : t.startsWith("🤝") ? "coin" : "tick");
    } else if (current.speaker !== lastSpeaker.current) {
      audio.motif(current.speaker as Speaker);
    }
    lastSpeaker.current = current.speaker;
  }, [current]);

  const sid = view?.session_id;
  const locked = busy || queue.length > 0;
  const phase = view?.phase;

  const makeOffer = () =>
    sid &&
    (audio.sfx("select"), true) && run(() => api.ultOffer(sid, offer), "partner", { speaker: "player", text: `I offer Tung Tung Tung Sahur **${fmt(offer)}** GPUs (I keep ${fmt(10000 - offer)}).` });
  const respond = (accept: boolean) =>
    sid &&
    (audio.sfx("select"), true) &&
    run(() => api.ultRespond(sid, accept), "partner", {
      speaker: "player",
      text: `I **${accept ? "accept" : "reject"}** your offer of ${fmt(view?.pending_offer_to_player ?? 0)}.`,
    });
  const answer = async (i: number) => {
    if (!sid) return;
    audio.sfx("select");
    const resp = await run(() => api.ultAnswer(sid, i), "tutor", { speaker: "player", text: `My answer: **${view?.challenge_options[i]}**` });
    if (resp) audio.sfx(resp.correct ? "fanfare" : resp.state.phase === "complete" ? "step" : "wrong");
  };
  const ask = () => {
    const text = draft.trim();
    if (!text || !sid || locked || !view?.tutor_questions_left) return;
    run(() => api.ultTutor(sid, text), "tutor", { speaker: "player", text });
    setDraft("");
  };
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      ask();
    }
  };

  const logRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [messages]);

  return (
    <div className="game ult">
      <div className="stage">
        <div className="canvas-wrap">
          <Canvas shadows camera={{ position: CAM.position, fov: 50 }}>
            {/* background + fog must sit directly on the scene (not inside a group) to apply */}
            <color attach="background" args={["#f7f9fc"]} />
            <fog attach="fog" args={["#f7f9fc", 14, 38]} />
            <CameraRig {...CAM} />
            <KingsCross avatar={avatar} playerTotal={view?.player_total ?? 0} tungTotal={view?.tung_total ?? 0} />
          </Canvas>
        </div>

        <div className="hud-top">
          <button className="ghost pill" onClick={onExit}>← Back to Equilibrium Hall</button>
          <span className="pill">
            🚉 The Ultimatum · Round <b>{view?.round ?? 1}</b>/4
          </span>
          <span className="pill score-pill">
            💾 You <b>{fmt(view?.player_total ?? 0)}</b> · Tung Tung Tung Sahur <b>{fmt(view?.tung_total ?? 0)}</b>
          </span>
        </div>

        {current?.speaker === "system" ? (
          <div className="result-card" onClick={next}>
            <Markdown>{current.text}</Markdown>
            <button className="primary" onClick={(e) => (e.stopPropagation(), next())}>
              Next ▸
            </button>
          </div>
        ) : current ? (
          <SpeechBubble
            key={`${messages.length}-${current.speaker}`}
            speaker={current.speaker as Speaker}
            text={pieces[piece]}
            index={piece}
            total={pieces.length}
            onNext={next}
            lastLabel={queue.length > 1 ? "Next" : "Got it"}
          />
        ) : (
          busy && <SpeechBubble key={`typing-${waitingOn}`} speaker={waitingOn} />
        )}

        {view && (phase === "challenge" || phase === "complete") && !locked && (
          <GameTree solved={phase === "complete"} />
        )}
      </div>

      <aside className="side">
        <div className="side-head">
          <div>
            <h2>Station transcript</h2>
            <small>
              {AVATARS[avatar].name} · Round {view?.round ?? 1} of 4 · pot 10,000 H100s
            </small>
          </div>
        </div>
        <div className="chat-log" ref={logRef}>
          {messages.map((m, i) => (
            <div key={i} className={`msg ${m.speaker}`}>
              <div className="who">{NAMES[m.speaker]}</div>
              <Markdown>{m.text}</Markdown>
            </div>
          ))}
        </div>

        <div className="composer">
          {view && !locked && phase === "propose" && (
            <>
              <div className="your-move" role="status">
                <span className="your-move-arrow" aria-hidden>⬇</span>
                <span>Your offer: how many GPUs for Tung Tung Tung Sahur?</span>
                <span className="your-move-arrow" aria-hidden>⬇</span>
              </div>
              <SplitBar you={10000 - offer} tung={offer} />
              <input
                className="offer-slider"
                type="range"
                min={0}
                max={10000}
                step={500}
                value={offer}
                onChange={(e) => setOffer(Number(e.target.value))}
                aria-label="GPUs to offer Tung Tung Tung Sahur"
              />
              <button className="primary big" onClick={makeOffer}>
                Offer {fmt(offer)} GPUs (you keep {fmt(10000 - offer)}) →
              </button>
            </>
          )}

          {view && !locked && phase === "respond" && view.pending_offer_to_player !== null && (
            <>
              <div className="your-move" role="status">
                <span className="your-move-arrow" aria-hidden>⬇</span>
                <span>Accept or reject his offer?</span>
                <span className="your-move-arrow" aria-hidden>⬇</span>
              </div>
              <SplitBar you={view.pending_offer_to_player} tung={10000 - view.pending_offer_to_player} />
              <div className="moves ready">
                <button className="move-btn silent" onClick={() => respond(true)}>
                  ✅ Accept
                  <small>you get {fmt(view.pending_offer_to_player)}</small>
                </button>
                <button className="move-btn confess" onClick={() => respond(false)}>
                  ❌ Reject
                  <small>nobody gets anything</small>
                </button>
              </div>
            </>
          )}

          {view && phase === "challenge" && (
            <>
              {!locked && (
                <div className="your-move" role="status">
                  <span className="your-move-arrow" aria-hidden>⬇</span>
                  <span>Smallest offer a GPU-only Tung Tung Tung Sahur should accept?</span>
                  <span className="your-move-arrow" aria-hidden>⬇</span>
                </div>
              )}
              <div className="challenge-options">
                {view.challenge_options.map((o, i) => (
                  <button key={o} className="quiz-opt" disabled={locked} onClick={() => answer(i)}>
                    {o}
                  </button>
                ))}
              </div>
              <textarea
                value={draft}
                rows={2}
                maxLength={300}
                disabled={locked || !view.tutor_questions_left}
                placeholder={
                  locked
                    ? "Click Next on the speech bubble to keep going…"
                    : view.tutor_questions_left
                      ? "Ask Nash-sensei anything before you choose… (Enter to send)"
                      : "Nash-sensei has answered your questions. Make your choice."
                }
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={onKey}
              />
              <div className="composer-row">
                <span>{view.tutor_questions_left} questions left for Nash-sensei</span>
              </div>
            </>
          )}

          {view && phase === "complete" && !locked && (
            <div className="final-score ult-final">
              <span>🚉 Final haul</span>
              <strong>💾 {fmt(view.player_total)}</strong>
              <small>
                Tung Tung Tung Sahur: {fmt(view.tung_total)} · lost to rejections: {fmt(40000 - view.player_total - view.tung_total)}
              </small>
              <div className="done-actions" style={{ marginTop: 8 }}>
                <button className="primary" onClick={start}>Play again</button>
                <button className="ghost" onClick={onExit}>Back to Equilibrium Hall</button>
              </div>
            </div>
          )}

          {locked && phase !== "challenge" && (
            <textarea disabled rows={1} placeholder={busy ? "…" : "Click Next to keep going…"} />
          )}
        </div>
      </aside>
    </div>
  );
}

function SplitBar({ you, tung }: { you: number; tung: number }) {
  const pct = (you / 10000) * 100;
  return (
    <div className="split">
      <div className="split-bar">
        <div className="split-you" style={{ width: `${pct}%` }}>
          {pct >= 10 && `🙋 ${fmt(you)}`}
        </div>
        <div className="split-tung" style={{ width: `${100 - pct}%` }}>
          {100 - pct >= 10 && `🪵 ${fmt(tung)}`}
        </div>
      </div>
    </div>
  );
}

/** Mini game tree; after the challenge it shows the backward-induction solution. */
function GameTree({ solved }: { solved: boolean }) {
  return (
    <div className={`game-tree ${solved ? "solved" : ""}`}>
      <h3>The Ultimatum as a game tree</h3>
      <svg viewBox="0 0 420 210" role="img" aria-label="Ultimatum game tree">
        <rect x="170" y="10" width="80" height="34" rx="17" className="node you" />
        <text x="210" y="32" textAnchor="middle">You</text>
        <line x1="210" y1="44" x2="210" y2="94" className="edge" />
        <text x="222" y="74" className="edge-label">offer x to him</text>
        <rect x="120" y="94" width="180" height="34" rx="17" className="node tung" />
        <text x="210" y="116" textAnchor="middle">Tung Tung Tung Sahur</text>
        <line x1="180" y1="128" x2="95" y2="172" className={`edge ${solved ? "chosen" : ""}`} />
        <line x1="240" y1="128" x2="325" y2="172" className="edge" />
        <text x="118" y="148" className="edge-label">accept</text>
        <text x="290" y="148" className="edge-label">reject</text>
        <text x="80" y="195" textAnchor="middle" className="payoff">(10,000 − x, x)</text>
        <text x="340" y="195" textAnchor="middle" className="payoff">(0, 0)</text>
      </svg>
      {solved ? (
        <p>
          <b>Backward induction:</b> at the last move he compares <b>x</b> with <b>0</b>, so any x &gt; 0 gets accepted. Knowing
          that, you offer the minimum: <b>(9,500, 500)</b>. Real players reject unfair offers anyway, and that threat is their power.
        </p>
      ) : (
        <p>Start at the bottom: what does Tung Tung Tung Sahur compare when he decides?</p>
      )}
    </div>
  );
}
