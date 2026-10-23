import { useState } from "react";
import { AvatarSelect } from "./scenes/AvatarSelect";
import { Hallway } from "./scenes/Hallway";
import { GameScreen } from "./game/GameScreen";
import type { AvatarId } from "./types";

type Screen = { name: "select" } | { name: "hallway"; avatar: AvatarId } | { name: "dilemma"; avatar: AvatarId };

// Shortcut for demos/screenshots: ?play=kimchi jumps straight into Door 1, ?hall=yoshi into the hallway.
function initialScreen(): Screen {
  const q = new URLSearchParams(window.location.search);
  const valid = (v: string | null): v is AvatarId => v === "yoshi" || v === "jujubee" || v === "kimchi";
  const play = q.get("play");
  const hall = q.get("hall");
  if (valid(play)) return { name: "dilemma", avatar: play };
  if (valid(hall)) return { name: "hallway", avatar: hall };
  return { name: "select" };
}

export default function App() {
  const [screen, setScreen] = useState<Screen>(initialScreen);

  if (screen.name === "select") return <AvatarSelect onPick={(avatar) => setScreen({ name: "hallway", avatar })} />;
  if (screen.name === "hallway")
    return (
      <Hallway
        avatar={screen.avatar}
        onEnter={() => setScreen({ name: "dilemma", avatar: screen.avatar })}
        onBack={() => setScreen({ name: "select" })}
      />
    );
  return <GameScreen avatar={screen.avatar} onExit={() => setScreen({ name: "hallway", avatar: screen.avatar })} />;
}
