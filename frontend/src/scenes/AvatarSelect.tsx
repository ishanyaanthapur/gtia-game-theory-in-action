// Avatar carousel: one samurai in the spotlight; scroll with arrows, arrow keys, mouse wheel, or the cards.
import { useEffect, useRef, useState } from "react";
import { audio } from "../audio/engine";
import { Canvas, useFrame } from "@react-three/fiber";
import { ContactShadows } from "@react-three/drei";
import type { Group } from "three";
import { AnimalSamurai } from "../characters/AnimalSamurai";
import { AVATARS, AVATAR_ORDER } from "../characters/avatars";
import type { AvatarId } from "../types";
import { Cyl } from "../characters/parts";
import { CameraAim } from "./CameraAim";

const N = AVATAR_ORDER.length;
const RADIUS = 1.9;
const STEP = (Math.PI * 2) / N;

export function AvatarSelect({ onPick }: { onPick: (a: AvatarId) => void }) {
  const [index, setIndex] = useState(0); // keeps counting past N so the turntable spins the short way
  const wheelLock = useRef(0);
  const current = AVATAR_ORDER[((index % N) + N) % N];
  const a = AVATARS[current];
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) return void (firstRender.current = false);
    audio.motif(current); // Yoshi's mew, Jujubee's hop, Kimchi's sly munch
  }, [current]);

  const go = (delta: number) => setIndex((i) => i + delta);
  const goTo = (id: AvatarId) =>
    setIndex((i) => {
      const target = AVATAR_ORDER.indexOf(id);
      const now = ((i % N) + N) % N;
      let d = target - now;
      if (d > N / 2) d -= N;
      if (d < -N / 2) d += N;
      return i + d;
    });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
      else if (e.key === "Enter") (audio.sfx("select"), onPick(current));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const onWheel = (e: React.WheelEvent) => {
    const now = Date.now();
    const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    if (Math.abs(d) < 8 || now - wheelLock.current < 450) return;
    wheelLock.current = now;
    go(d > 0 ? 1 : -1);
  };

  return (
    <div className="screen select-screen">
      <header className="title-block">
        <p className="eyebrow">GTiA · Game Theory in Action</p>
        <h1>Choose your samurai</h1>
        <p className="sub">Every door in Equilibrium Hall is a game. Every opponent is an AI. Learn the theory by living it.</p>
      </header>

      <div className="select-stage" onWheel={onWheel}>
        <Canvas shadows camera={{ position: [0, 1.45, RADIUS + 5.0], fov: 38 }}>
          <CameraAim target={[0, 1.32, RADIUS - 0.4]} />
          <color attach="background" args={["#0b0614"]} />
          <ambientLight intensity={0.55} />
          <directionalLight position={[3, 5, 6]} intensity={1.4} castShadow />
          <spotLight position={[0, 4.5, RADIUS + 1.5]} angle={0.4} penumbra={0.6} intensity={40} color="#e9d5ff" />
          <pointLight position={[0, 2.5, RADIUS + 1]} color={a.armor} intensity={5} distance={6} />
          <Turntable index={index} active={current} onPick={goTo} />
          <ContactShadows position={[0, 0.01, 0]} opacity={0.5} scale={12} blur={2.5} />
        </Canvas>
        <button className="carousel-arrow left" aria-label="Previous character" onClick={() => go(-1)}>‹</button>
        <button className="carousel-arrow right" aria-label="Next character" onClick={() => go(1)}>›</button>
        {/* keyed so it re-animates every time you scroll to a new character */}
        <div key={current} className="spotlight-head" style={{ ["--accent" as string]: a.armor }}>
          <h2>{a.name}</h2>
          <span className="species">{a.species}</span>
          <div className="traits">
            {a.traits.map((t) => (
              <span key={t} className="trait">{t}</span>
            ))}
          </div>
          <p>{a.blurb}</p>
        </div>
      </div>

      <div className="avatar-cards">
        {AVATAR_ORDER.map((id) => {
          const c = AVATARS[id];
          return (
            <button
              key={id}
              className={`avatar-card ${current === id ? "chosen" : ""}`}
              style={{ ["--accent" as string]: c.armor }}
              onClick={() => goTo(id)}
            >
              <strong>{c.name}</strong>
              <span>{c.traits.join(" · ")}</span>
            </button>
          );
        })}
      </div>

      <button className="primary big" onClick={() => (audio.sfx("select"), onPick(current))}>
        Enter Equilibrium Hall as {a.name} →
      </button>
      <p className="fine" style={{ margin: 0 }}>Scroll, use ← → keys, or click a card to switch characters</p>
    </div>
  );
}

function Turntable({ index, active, onPick }: { index: number; active: AvatarId; onPick: (id: AvatarId) => void }) {
  const ring = useRef<Group>(null);
  useFrame((_, dt) => {
    if (!ring.current) return;
    const goal = -index * STEP;
    ring.current.rotation.y += (goal - ring.current.rotation.y) * (1 - Math.pow(0.002, dt));
  });

  return (
    <group ref={ring}>
      {AVATAR_ORDER.map((id, i) => {
        const angle = i * STEP;
        const isActive = id === active;
        return (
          <group
            key={id}
            position={[Math.sin(angle) * RADIUS, 0, Math.cos(angle) * RADIUS]}
            rotation={[0, angle, 0]}
            onClick={(e) => (e.stopPropagation(), onPick(id))}
          >
            <Cyl top={0.55} bottom={0.6} h={0.12} position={[0, 0.06, 0]} color={isActive ? AVATARS[id].armor : "#2a1745"} />
            <AnimalSamurai avatar={id} position={[0, 0.12, 0]} scale={isActive ? 1.15 : 0.9} />
          </group>
        );
      })}
    </group>
  );
}
