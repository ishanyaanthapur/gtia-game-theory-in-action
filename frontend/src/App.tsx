import { useState } from "react";
import { AvatarSelect } from "./scenes/AvatarSelect";
import { Hallway } from "./scenes/Hallway";
import { GameScreen } from "./game/GameScreen";
import { UltimatumScreen } from "./game/UltimatumScreen";
import { Quiz, QuizResults } from "./ui/Quiz";
import type { AvatarId, QuizResult } from "./types";

type Screen =
  | { name: "select" }
  | { name: "hallway"; avatar: AvatarId }
  | { name: "precheck"; avatar: AvatarId; preview?: boolean }
  | { name: "dilemma"; avatar: AvatarId }
  | { name: "ultimatum"; avatar: AvatarId }
  | { name: "postcheck"; avatar: AvatarId; sessionId: string | null; preview?: boolean }
  | { name: "results"; avatar: AvatarId; result: QuizResult };

// Before/after check status for this page load. A reload = a new tester (handy on a shared laptop).
type CheckState = { stage: "none" } | { stage: "skipped" } | { stage: "pre_done"; pid: string } | { stage: "post_done" };

// Shortcuts for demos/screenshots (?preview=pre|post opens a check in no-save preview mode): ?play=kimchi jumps into Door 1 (no pre-check), ?play=kimchi&check=1 starts at
// the pre-check (for user tests), ?hall=yoshi opens the hallway.
function initialScreen(): Screen {
  const q = new URLSearchParams(window.location.search);
  const valid = (v: string | null): v is AvatarId => v === "yoshi" || v === "jujubee" || v === "kimchi";
  const preview = q.get("preview"); // ?preview=pre or ?preview=post: view a check without saving answers
  if (preview === "pre") return { name: "precheck", avatar: "kimchi", preview: true };
  if (preview === "post") return { name: "postcheck", avatar: "kimchi", sessionId: null, preview: true };
  const play = q.get("play");
  const hall = q.get("hall");
  const ult = q.get("ultimatum");
  if (valid(ult)) return { name: "ultimatum", avatar: ult };
  if (valid(play)) return { name: q.get("check") === "1" ? "precheck" : "dilemma", avatar: play };
  if (valid(hall)) return { name: "hallway", avatar: hall };
  return { name: "select" };
}

const newParticipantId = () => crypto.randomUUID();

export default function App() {
  const [screen, setScreen] = useState<Screen>(initialScreen);
  const [check, setCheck] = useState<CheckState>({ stage: "none" });
  const [pendingPid] = useState(newParticipantId);

  switch (screen.name) {
    case "select":
      return <AvatarSelect onPick={(avatar) => setScreen({ name: "hallway", avatar })} />;
    case "hallway":
      return (
        <Hallway
          avatar={screen.avatar}
          onEnter={(doorId) =>
            setScreen(
              doorId === 3
                ? { name: "ultimatum", avatar: screen.avatar }
                : check.stage === "none"
                  ? { name: "precheck", avatar: screen.avatar }
                  : { name: "dilemma", avatar: screen.avatar },
            )
          }
          onBack={() => setScreen({ name: "select" })}
        />
      );
    case "precheck":
      return (
        <Quiz
          phase="pre"
          participantId={pendingPid}
          preview={screen.preview}
          onDone={() => {
            if (screen.preview) return setScreen({ name: "postcheck", avatar: screen.avatar, sessionId: null, preview: true });
            setCheck({ stage: "pre_done", pid: pendingPid });
            setScreen({ name: "dilemma", avatar: screen.avatar });
          }}
          onSkip={() => {
            setCheck({ stage: "skipped" });
            setScreen({ name: "dilemma", avatar: screen.avatar });
          }}
        />
      );
    case "dilemma":
      return (
        <GameScreen
          avatar={screen.avatar}
          onExit={() => setScreen({ name: "hallway", avatar: screen.avatar })}
          onAfterCheck={
            check.stage === "pre_done"
              ? (sessionId) => setScreen({ name: "postcheck", avatar: screen.avatar, sessionId })
              : undefined
          }
        />
      );
    case "postcheck":
      return (
        <Quiz
          phase="post"
          participantId={check.stage === "pre_done" ? check.pid : pendingPid}
          sessionId={screen.sessionId}
          preview={screen.preview}
          onDone={(result) => {
            setCheck({ stage: "post_done" });
            setScreen({ name: "results", avatar: screen.avatar, result });
          }}
        />
      );
    case "ultimatum":
      return <UltimatumScreen avatar={screen.avatar} onExit={() => setScreen({ name: "hallway", avatar: screen.avatar })} />;
    case "results":
      return <QuizResults result={screen.result} onContinue={() => setScreen({ name: "hallway", avatar: screen.avatar })} />;
  }
}
