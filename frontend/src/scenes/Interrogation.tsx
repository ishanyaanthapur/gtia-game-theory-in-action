// Interrogation room: Detective Zhou across the table, Tung Tung Tung Sahur visible through the window.
import { Label3D } from "./Label3D";
import { AnimalSamurai } from "../characters/AnimalSamurai";
import { Cop } from "../characters/Cop";
import { TungTung } from "../characters/TungTung";
import { Box, Cone, Cyl } from "../characters/parts";
import type { AvatarId } from "../types";
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";
import { SpeechAnchor } from "./SpeechAnchor";

const WALL = "#3b4252";
const WALL_DARK = "#2e3440";

export function Interrogation({ avatar, copTalking }: { avatar: AvatarId; copTalking: boolean }) {
  // copTalking: the cop stops pacing and faces you while a bubble (or the ••• indicator) is up.
  return (
    <group>
      <ambientLight intensity={0.35} color="#9fb3d1" />
      {/* the single hanging lamp over the table */}
      <spotLight position={[0, 3.2, 0]} angle={0.75} penumbra={0.5} intensity={30} color="#ffd9a0" castShadow target-position={[0, 0, 0]} />
      <Cyl top={0.01} bottom={0.01} h={0.6} position={[0, 3.2, 0]} color="#111" />
      <Cone r={0.32} h={0.25} position={[0, 2.85, 0]} color="#1f2937" />
      <mesh position={[0, 2.74, 0]}>
        <sphereGeometry args={[0.09, 12, 12]} />
        <meshBasicMaterial color="#fff3c4" />
      </mesh>

      {/* room shell */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[8, 8]} />
        <meshStandardMaterial color="#262b36" />
      </mesh>
      <Box size={[8, 3.5, 0.1]} position={[0, 1.75, -4]} color={WALL} />
      <Box size={[0.1, 3.5, 8]} position={[4, 1.75, 0]} color={WALL_DARK} />
      {/* left wall: a big one-way observation window into Room B */}
      <Box size={[0.1, 3.5, 0.6]} position={[-4, 1.75, -3.7]} color={WALL_DARK} />
      <Box size={[0.1, 3.5, 3]} position={[-4, 1.75, 2.5]} color={WALL_DARK} />
      <Box size={[0.1, 0.15, 4.4]} position={[-4, 0.075, -1.2]} color={WALL_DARK} />
      <Box size={[0.1, 0.6, 4.4]} position={[-4, 3.2, -1.2]} color={WALL_DARK} />
      <mesh position={[-4, 1.525, -1.2]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[4.4, 2.75]} />
        <meshStandardMaterial color="#93c5fd" transparent opacity={0.08} />
      </mesh>
      {/* window frame */}
      <Box size={[0.14, 0.06, 4.5]} position={[-3.98, 2.9, -1.2]} color="#111827" />
      <Box size={[0.14, 0.06, 4.5]} position={[-3.98, 0.15, -1.2]} color="#111827" />
      <Box size={[0.14, 2.8, 0.06]} position={[-3.98, 1.52, -3.4]} color="#111827" />
      <Box size={[0.14, 2.8, 0.06]} position={[-3.98, 1.52, 1.0]} color="#111827" />
      <Label3D position={[-3.45, 3.18, -1.2]} title="Room B" subtitle="Tung Tung Tung Sahur" accent="#e3a86b" width={1.7} />

      {/* Room B: a second cop grilling a very scared Tung Tung Tung Sahur */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-6, 0, -1]}>
        <planeGeometry args={[4, 6]} />
        <meshStandardMaterial color="#2a1f1a" />
      </mesh>
      <Box size={[0.1, 3.5, 6]} position={[-8, 1.75, -1]} color="#3a2a22" />
      <Box size={[4, 3.5, 0.1]} position={[-6, 1.75, -4]} color="#33251e" />
      <Box size={[4, 3.5, 0.1]} position={[-6, 1.75, 2]} color="#33251e" />
      <Cone r={0.28} h={0.22} position={[-5.5, 3.0, -1.5]} color="#1f2937" />
      <pointLight position={[-5.5, 2.7, -1.2]} color="#ffb27a" intensity={9} distance={6} />
      <pointLight position={[-4.6, 1.6, 0.2]} color="#c7d2fe" intensity={3} distance={4} />
      <TungTung position={[-5.0, 0, -0.9]} rotation={[0, 0.7, 0]} scale={0.95} scared />
      <group position={[-5.0, 0, -0.9]}>
        <SpeechAnchor id="partner" offset={[0, 2.15, 0]} />
      </group>
      <Cop variant="officer" talking position={[-5.3, 0, -2.75]} rotation={[0, 0.25, 0]} />

      {/* table + the player's chair */}
      <Box size={[2.4, 0.08, 1.3]} position={[0, 0.78, 0]} color="#4b5563" />
      {[-1.1, 1.1].flatMap((x) => [-0.55, 0.55].map((z) => <Box key={`${x}${z}`} size={[0.06, 0.78, 0.06]} position={[x, 0.39, z]} color="#374151" />))}
      <Box size={[0.3, 0.02, 0.22]} position={[0.5, 0.83, 0.1]} rotation={[0, 0.3, 0]} color="#f5f5dc" />
      <group position={[0, 0, 1.2]}>
        <Box size={[0.66, 0.06, 0.6]} position={[0, 0.4, 0]} color="#1f2937" />
        <Box size={[0.66, 0.75, 0.06]} position={[0, 0.78, 0.3]} color="#1f2937" />
        {[-0.28, 0.28].flatMap((x) => [-0.25, 0.25].map((z) => <Box key={`${x}${z}`} size={[0.05, 0.4, 0.05]} position={[x, 0.2, z]} color="#111827" />))}
      </group>

      {/* Detective Zhou stands and paces behind the table */}
      <PacingCop talking={copTalking} />

      {/* the player, seated, back to camera */}
      <AnimalSamurai avatar={avatar} seated bob={false} position={[0, 0, 1.15]} rotation={[0, Math.PI, 0]} scale={1.05} />
    </group>
  );
}

function PacingCop({ talking }: { talking: boolean }) {
  const ref = useRef<Group>(null);
  const t = useRef(0);
  useFrame((_, dt) => {
    const g = ref.current;
    if (!g) return;
    if (!talking) t.current += dt; // freeze the pacing cycle while speaking
    const x = Math.sin(t.current * 0.5) * 1.15;
    const walkingRight = Math.cos(t.current * 0.5) > 0;
    g.position.x += (x - g.position.x) * Math.min(1, dt * 4);
    g.position.y = talking ? 0 : Math.abs(Math.sin(t.current * 4)) * 0.03;
    const face = talking ? -0.1 * Math.sign(g.position.x) : walkingRight ? Math.PI / 2 : -Math.PI / 2;
    g.rotation.y += (face - g.rotation.y) * Math.min(1, dt * 5);
  });
  return (
    <group ref={ref} position={[0, 0, -1.55]}>
      <Cop talking={talking} />
      <SpeechAnchor id="cop" offset={[0, 2.25, 0]} />
    </group>
  );
}
