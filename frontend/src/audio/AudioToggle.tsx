import { useEffect, useState } from "react";
import { audio } from "./engine";

/** Floating 🔊/🔇 button. Remembers the choice; music starts on the first click/keypress (browser rule). */
export function AudioToggle() {
  const [muted, setMuted] = useState(audio.muted);
  useEffect(() => audio.subscribe(() => setMuted(audio.muted)), []);
  return (
    <button
      className="audio-toggle"
      title={muted ? "Turn sound on" : "Mute music and sound effects"}
      aria-label={muted ? "Unmute" : "Mute"}
      onClick={() => audio.setMuted(!muted)}
    >
      {muted ? "🔇" : "🔊"}
    </button>
  );
}
