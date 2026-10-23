import { useState } from "react";
import { Canvas } from "@react-three/fiber";
import { ContactShadows } from "@react-three/drei";
import { AnimalSamurai } from "../characters/AnimalSamurai";
import { AVATARS, AVATAR_ORDER } from "../characters/avatars";
import type { AvatarId } from "../types";
import { Cyl } from "../characters/parts";
import { CameraAim } from "./CameraAim";

export function AvatarSelect({ onPick }: { onPick: (a: AvatarId) => void }) {
  const [chosen, setChosen] = useState<AvatarId | null>(null);
  const [hover, setHover] = useState<AvatarId | null>(null);

  return (
    <div className="screen select-screen">
      <header className="title-block">
        <p className="eyebrow">GTiA · Game Theory in Action</p>
        <h1>Choose your samurai</h1>
        <p className="sub">Every door in the hall is a game. Every opponent is an AI. Learn the theory by living it.</p>
      </header>

      <div className="select-stage">
        <Canvas shadows camera={{ position: [0, 1.25, 4.3], fov: 40 }}>
          <CameraAim target={[0, 0.8, 0]} />
          <color attach="background" args={["#0b0614"]} />
          <ambientLight intensity={0.7} />
          <directionalLight position={[3, 5, 4]} intensity={1.6} castShadow />
          <pointLight position={[0, 2.5, 2]} color="#a855f7" intensity={6} distance={8} />
          {AVATAR_ORDER.map((id, i) => {
            const x = (i - 1) * 1.9;
            const active = chosen === id || hover === id;
            return (
              <group
                key={id}
                position={[x, 0, 0]}
                onClick={() => setChosen(id)}
                onPointerOver={() => setHover(id)}
                onPointerOut={() => setHover(null)}
              >
                <Cyl top={0.55} bottom={0.6} h={0.12} position={[0, 0.06, 0]} color={active ? AVATARS[id].armor : "#2a1745"} />
                <AnimalSamurai avatar={id} position={[0, 0.12, 0]} rotation={[0, active ? 0 : -0.25 + i * 0.25, 0]} scale={active ? 1.1 : 1} />
              </group>
            );
          })}
          <ContactShadows position={[0, 0.01, 0]} opacity={0.5} scale={10} blur={2.5} />
        </Canvas>
      </div>

      <div className="avatar-cards">
        {AVATAR_ORDER.map((id) => {
          const a = AVATARS[id];
          return (
            <button
              key={id}
              className={`avatar-card ${chosen === id ? "chosen" : ""}`}
              style={{ ["--accent" as string]: a.armor }}
              onClick={() => setChosen(id)}
              onMouseEnter={() => setHover(id)}
              onMouseLeave={() => setHover(null)}
            >
              <strong>{a.name}</strong>
              <span>{a.species}</span>
              <em>{a.blurb}</em>
            </button>
          );
        })}
      </div>

      <button className="primary big" disabled={!chosen} onClick={() => chosen && onPick(chosen)}>
        {chosen ? `Enter the hall as ${AVATARS[chosen].name} →` : "Pick an avatar"}
      </button>
    </div>
  );
}
