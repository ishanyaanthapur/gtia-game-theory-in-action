// Comic-style speech bubble that floats over the speaking character's head. Click "Next" (or press
// Space/Enter) to go through the conversation pieces.
import { useEffect, useRef } from "react";
import Markdown from "react-markdown";
import { anchors, type Speaker } from "../scenes/SpeechAnchor";

const NAMES: Record<Speaker, string> = { cop: "Detective Zhou", partner: "Tung Tung Tung Sahur", tutor: "Nash-sensei" };

interface Props {
  speaker: Speaker;
  text?: string; // undefined = typing indicator
  index?: number;
  total?: number;
  onNext?: () => void;
  lastLabel?: string;
}

export function SpeechBubble({ speaker, text, index = 0, total = 1, onNext, lastLabel = "Got it" }: Props) {
  const el = useRef<HTMLDivElement>(null);

  // Follow the character: read its projected head position every animation frame.
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const a = anchors[speaker];
      const box = el.current;
      const stage = box?.parentElement;
      if (box && stage) {
        if (a?.visible) {
          const w = box.offsetWidth;
          const h = box.offsetHeight;
          const x = Math.max(12, Math.min(stage.clientWidth - w - 12, a.x - w / 2));
          const y = Math.max(56, a.y - h - 18);
          box.style.transform = `translate(${x}px, ${y}px)`;
          box.style.setProperty("--tail-x", `${Math.max(24, Math.min(w - 24, a.x - x))}px`);
          box.style.opacity = "1";
        } else {
          box.style.opacity = "0";
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [speaker]);

  useEffect(() => {
    if (!onNext) return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "TEXTAREA" || tag === "INPUT") return;
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onNext();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onNext]);

  const last = index >= total - 1;
  return (
    <div ref={el} className={`bubble ${speaker}`} style={{ opacity: 0 }} onClick={onNext}>
      <div className="bubble-who">{NAMES[speaker]}</div>
      {text === undefined ? (
        <span className="typing" aria-label="AI is responding">
          <span />
          <span />
          <span />
        </span>
      ) : (
        <>
          <div className="bubble-text">
            <Markdown>{text}</Markdown>
          </div>
          <div className="bubble-foot">
            <span>{total > 1 ? `${index + 1} / ${total}` : ""}</span>
            <button className="bubble-next" onClick={(e) => (e.stopPropagation(), onNext?.())}>
              {last ? lastLabel : "Next"} ▸
            </button>
          </div>
        </>
      )}
    </div>
  );
}
