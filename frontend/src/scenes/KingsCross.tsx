// Door 3: a dazzlingly bright, spotless King's Cross station. You and Tung Tung Tung Sahur sit on a
// bench splitting the GPU loot; Nash-sensei floats beside the stash. GPU piles grow with each player's total.
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";
import { AnimalSamurai } from "../characters/AnimalSamurai";
import { Kitsune } from "../characters/Kitsune";
import { TungTung } from "../characters/TungTung";
import { Box, Cyl, Ring } from "../characters/parts";
import type { AvatarId } from "../types";
import { Label3D } from "./Label3D";
import { SpeechAnchor } from "./SpeechAnchor";

const WHITE = "#ffffff";
const TILE = "#eef2f7";
const STEEL = "#dfe5ee";
const SAFETY = "#facc15";

export function KingsCross({ avatar, playerTotal, tungTotal }: { avatar: AvatarId; playerTotal: number; tungTotal: number }) {
  return (
    <group>
      <ambientLight intensity={1.35} />
      <hemisphereLight args={["#ffffff", "#e2e8f0", 1.2]} />
      <directionalLight position={[4, 10, 6]} intensity={1.6} castShadow />
      <pointLight position={[0, 6, 2]} intensity={10} distance={18} color="#fffaf0" />

      {/* polished floor with tile lines */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -6]} receiveShadow>
        <planeGeometry args={[30, 40]} />
        <meshStandardMaterial color={TILE} roughness={0.25} metalness={0.05} />
      </mesh>
      {Array.from({ length: 13 }, (_, i) => (
        <Box key={`t${i}`} size={[0.02, 0.005, 40]} position={[-12 + i * 2, 0.003, -6]} color="#dde4ee" />
      ))}

      {/* platforms with yellow safety lines + tracks */}
      {[-6.5, 6.5].map((x) => (
        <group key={x}>
          <Box size={[4, 0.35, 34]} position={[x, 0.17, -10]} color={WHITE} />
          <Box size={[0.12, 0.01, 34]} position={[x - Math.sign(x) * 1.85, 0.355, -10]} color={SAFETY} />
        </group>
      ))}
      {[-9.6, -10.6].map((x) => (
        <Box key={x} size={[0.08, 0.06, 34]} position={[x, 0.03, -10]} color="#b6c0cd" />
      ))}

      {/* the arched train-shed roof */}
      {Array.from({ length: 8 }, (_, i) => (
        <Ring key={`a${i}`} r={11} tube={0.12} position={[0, 0.5, 4 - i * 4]} rotation={[0, 0, 0]} color={STEEL} />
      ))}
      {[-1, 1].map((s) => (
        <Box key={s} size={[0.12, 0.12, 32]} position={[s * 7.8, 8.2, -10]} rotation={[0, 0, s * 0.78]} color={STEEL} />
      ))}

      {/* sleek white train on the left track */}
      <group position={[-10.1, 0, -9]}>
        <Box size={[2.4, 2.6, 18]} position={[0, 1.55, 0]} color={WHITE} />
        <Box size={[2.45, 0.5, 17]} position={[0, 2.1, 0]} color="#c4b5fd" />
        <Box size={[2.42, 0.12, 18]} position={[0, 0.6, 0]} color="#a855f7" />
        <mesh position={[0, 1.55, 9]} scale={[1.2, 1.3, 1.8]}>
          <sphereGeometry args={[1, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color={WHITE} />
        </mesh>
      </group>

      {/* station clock + sign */}
      <group position={[0, 5.4, -7]}>
        <Cyl top={0.03} bottom={0.03} h={2} position={[0, 1.3, 0]} color="#94a3b8" />
        <Cyl top={0.9} bottom={0.9} h={0.18} rotation={[Math.PI / 2, 0, 0]} color={WHITE} />
        <Ring r={0.9} tube={0.06} color="#334155" />
        <Box size={[0.06, 0.55, 0.02]} position={[0, 0.25, 0.11]} color="#0f172a" />
        <Box size={[0.4, 0.06, 0.02]} position={[0.18, 0, 0.11]} rotation={[0, 0, 0.3]} color="#0f172a" />
      </group>
      <Label3D position={[0, 3.6, -4]} title="King's Cross" subtitle="Door 3 · The Ultimatum" accent="#7c3aed" width={2.8} />

      {/* the bench */}
      <group position={[0, 0, 0]}>
        <Box size={[3.4, 0.12, 0.8]} position={[0, 0.5, 0]} color="#ffffff" />
        <Box size={[3.4, 0.9, 0.1]} position={[0, 0.98, -0.4]} color="#f1f5f9" />
        <Box size={[3.4, 0.44, 0.06]} position={[0, 0.22, 0.36]} color="#e2e8f0" />
        {[-1.5, 1.5].map((x) => (
          <Box key={x} size={[0.1, 0.5, 0.75]} position={[x, 0.25, 0]} color="#cbd5e1" />
        ))}
      </group>

      {/* you (seated) + Tung Tung Tung Sahur (perched on the bench) */}
      <AnimalSamurai avatar={avatar} seated bob={false} position={[-0.8, 0.1, 0.05]} scale={1.05} />
      <TungTung position={[0.85, 0.5, -0.05]} rotation={[0, -0.25, 0]} scale={0.78} />
      <group position={[0.85, 0.5, -0.05]}>
        <SpeechAnchor id="partner" offset={[0, 1.8, 0]} />
      </group>

      {/* each player's GPU pile grows with their total */}
      <GpuPile position={[-1.9, 0, 0.9]} count={Math.ceil(playerTotal / 1000)} />
      <GpuPile position={[1.9, 0, 0.9]} count={Math.ceil(tungTotal / 1000)} />

      {/* the stash Nash-sensei holds */}
      <group position={[3.3, 0, -0.6]}>
        <GpuPile position={[0, 0, 0]} count={10} />
        <Label3D position={[0, 1.55, 0]} title="10,000 H100s" subtitle="the stash" accent="#16a34a" width={1.3} />
      </group>
      <Kitsune position={[3.4, 0, 1.2]} scale={0.7} />
      <group position={[3.4, 0, 1.2]}>
        <SpeechAnchor id="tutor" offset={[0, 1.9, 0]} />
      </group>
    </group>
  );
}

/** A neat stack of green GPU boards (one board per 1,000 GPUs). */
function GpuPile({ position, count }: { position: [number, number, number]; count: number }) {
  const ref = useRef<Group>(null);
  const shown = useRef(0);
  useFrame((_, dt) => {
    // boards "grow" into the pile one at a time when the total changes
    shown.current += (count - shown.current) * Math.min(1, dt * 3);
    if (!ref.current) return;
    ref.current.children.forEach((c, i) => (c.visible = i < Math.round(shown.current)));
  });
  return (
    <group ref={ref} position={position}>
      {Array.from({ length: 12 }, (_, i) => (
        <group key={i} position={[(i % 2) * 0.05 - 0.025, 0.06 + i * 0.1, (i % 3) * 0.03]} rotation={[0, (i % 4) * 0.25, 0]}>
          <Box size={[0.62, 0.08, 0.36]} color="#16a34a" />
          <Box size={[0.56, 0.02, 0.06]} position={[0, 0.045, 0.12]} color="#fbbf24" />
          <Box size={[0.16, 0.02, 0.12]} position={[0, 0.045, -0.03]} color="#0f172a" />
        </group>
      ))}
    </group>
  );
}
