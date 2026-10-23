import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import Markdown from "react-markdown";
import { AVATARS } from "../characters/avatars";
import type { AvatarId, Message, Move, SessionView, Usage } from "../types";

const NAMES: Record<Message["speaker"], string> = {
  cop: "Detective Byte",
  partner: "Tung Tung Tung Sahur",
  tutor: "Nash-sensei",
  player: "You",
  system: "Game",
};

interface Props {
  avatar: AvatarId;
  messages: Message[];
  view: SessionView | null;
  busy: boolean;
  usage: Usage | null;
  onSend: (text: string) => void;
  onMove: (m: Move) => void;
}

export function ChatPanel({ avatar, messages, view, busy, usage, onSend, onMove }: Props) {
  const [draft, setDraft] = useState("");
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "auto" });
  }, [messages, busy]);

  const interrogating = view?.phase === "interrogation";
  const chatLeft = view?.cop_messages_left ?? 0;
  const canChat = interrogating && !busy && chatLeft > 0;

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
          <h2>Case file · Dilemma Detectives</h2>
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
        {busy && (
          <div className="msg system" style={{ alignSelf: "flex-start", background: "transparent", border: "none" }}>
            <span className="typing" aria-label="AI is responding">
              <span />
              <span />
              <span />
            </span>
          </div>
        )}
      </div>

      <div className="composer">
        {interrogating && (
          <div className="moves">
            {(["silent", "confess"] as Move[]).map((m) => {
              const locked = view?.locked_moves.includes(m);
              return (
                <button key={m} className={`move-btn ${m}`} disabled={busy || locked} onClick={() => onMove(m)}>
                  {m === "silent" ? "🤐 Stay Silent" : "🗣️ Confess"}
                  <small>{locked ? "Already explored" : m === "silent" ? "Protect Tung Tung" : "Blame Tung Tung"}</small>
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
              ? "Detective Byte is getting ready…"
              : !interrogating
              ? "Fill in the payoff matrix with Nash-sensei →"
              : chatLeft > 0
                ? "Talk to Detective Byte… (Enter to send, Shift+Enter for a new line)"
                : "Detective Byte is done talking. Make your choice."
          }
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKey}
        />
        <div className="composer-row">
          <span>{interrogating ? `${chatLeft} question${chatLeft === 1 ? "" : "s"} left this round` : ""}</span>
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
