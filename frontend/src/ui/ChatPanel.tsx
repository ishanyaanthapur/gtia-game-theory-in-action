import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import Markdown from "react-markdown";
import { AVATARS } from "../characters/avatars";
import type { AvatarId, Message, Move, SessionView, Usage } from "../types";

const NAMES: Record<Message["speaker"], string> = {
  cop: "Detective Zhou",
  partner: "Tung Tung Tung Sahur",
  tutor: "Nash-sensei",
  player: "You",
  system: "Game",
};

interface Props {
  avatar: AvatarId;
  messages: Message[];
  view: SessionView | null;
  busy: boolean; // true while the AI is thinking OR a speech bubble is still being read
  dialoguePending: boolean;
  usage: Usage | null;
  onSend: (text: string) => void;
  onMove: (m: Move, prediction?: Move | null) => void;
}

export function ChatPanel({ avatar, messages, view, busy, dialoguePending, usage, onSend, onMove }: Props) {
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState<Move | null>(null); // chosen move, waiting for the bonus prediction
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "auto" });
  }, [messages, busy]);

  const interrogating = view?.phase === "interrogation";
  const challenge = view?.phase === "challenge"; // name your dominant strategy; questions go to Nash-sensei
  const choosing = interrogating || challenge;
  const chatLeft = (challenge ? view?.tutor_questions_left : view?.cop_messages_left) ?? 0;
  const canChat = choosing && !busy && chatLeft > 0;

  useEffect(() => {
    setPending(null);
  }, [view?.round, view?.phase]);
  const commit = (prediction: Move | null) => {
    if (!pending) return;
    onMove(pending, prediction);
    setPending(null);
  };

  const send = () => {
    const text = draft.trim();
    if (!text || !canChat) return;
    onSend(text);
    setDraft("");
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <aside className="side">
      <div className="side-head">
        <div>
          <h2>Case transcript</h2>
          <small>
            {AVATARS[avatar].name} · Round {view ? Math.min(view.round, view.max_rounds) : 1} of {view?.max_rounds ?? 4}
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
        {interrogating && pending && !busy && (
          <div className="bet" role="dialog" aria-label="Bonus prediction">
            <div className="bet-title">
              🔮 Bonus bet <b>+50</b>: what did Tung Tung Tung Sahur do?
            </div>
            <div className="bet-row">
              <button className="bet-btn" onClick={() => commit("silent")}>🤐 He stayed silent</button>
              <button className="bet-btn" onClick={() => commit("confess")}>🗣️ He confessed</button>
            </div>
            <div className="bet-foot">
              You chose <b>{pending === "silent" ? "Stay Silent" : "Confess"}</b>.{" "}
              <button className="linkish" onClick={() => setPending(null)}>change</button> ·{" "}
              <button className="linkish" onClick={() => commit(null)}>skip the bet</button>
            </div>
          </div>
        )}
        {choosing && !busy && !pending && (
          <div className="your-move" role="status">
            <span className="your-move-arrow" aria-hidden>⬇</span>
            <span>{challenge ? "Which is YOUR dominant strategy?" : "Your move: stay silent or confess?"}</span>
            <span className="your-move-arrow" aria-hidden>⬇</span>
          </div>
        )}
        {choosing && !pending && (
          <div className={`moves ${!busy ? "ready" : ""}`}>
            {(["silent", "confess"] as Move[]).map((m) => {
              const locked = interrogating && view?.locked_moves.includes(m);
              const sub = challenge
                ? "is my dominant strategy"
                : locked
                  ? "Already explored"
                  : m === "silent"
                    ? "Protect Tung Tung Tung Sahur"
                    : "Blame Tung Tung Tung Sahur";
              return (
                <button key={m} className={`move-btn ${m}`} disabled={busy || locked} onClick={() => (interrogating ? setPending(m) : onMove(m))}>
                  {m === "silent" ? "🤐 Stay Silent" : "🗣️ Confess"}
                  <small>{sub}</small>
                </button>
              );
            })}
          </div>
        )}
        <textarea
          value={draft}
          maxLength={300}
          rows={2}
          disabled={!canChat}
          placeholder={
            !view
              ? "Detective Zhou is getting ready…"
              : dialoguePending
              ? "Click Next on the speech bubble to keep going…"
              : challenge
              ? chatLeft > 0
                ? "Ask Nash-sensei anything before you choose… (Enter to send)"
                : "Nash-sensei has answered your questions. Make your choice."
              : !interrogating
              ? "Fill in the payoff matrix with Nash-sensei →"
              : chatLeft > 0
                ? "Talk to Detective Zhou… (Enter to send, Shift+Enter for a new line)"
                : "Detective Zhou is done talking. Make your choice."
          }
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKey}
        />
        <div className="composer-row">
          <span>
            {choosing ? `${chatLeft} question${chatLeft === 1 ? "" : "s"} left${challenge ? " for Nash-sensei" : " this round"}` : ""}
          </span>
          {usage && view && (
            <span className="usage" title="Measured from the backend token log">
              <span>AI calls <b>{view.llm_calls_used}/{view.llm_calls_limit}</b></span>
              <span>in <b>{usage.input_tokens.toLocaleString()}</b></span>
              <span>cached <b>{usage.cached_input_tokens.toLocaleString()}</b></span>
              <span>out <b>{usage.output_tokens.toLocaleString()}</b></span>
            </span>
          )}
        </div>
      </div>
    </aside>
  );
}
