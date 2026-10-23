// Jail cells: the player and Tung Tung Tung Sahur side by side (or free outside), Nash-sensei appears in foxfire.
import { Label3D } from "./Label3D";
import { AnimalSamurai } from "../characters/AnimalSamurai";
import { Kitsune } from "../characters/Kitsune";
import { TungTung } from "../characters/TungTung";
import { Box, Cyl } from "../characters/parts";
import type { AvatarId, RoundResult } from "../types";
import { SpeechAnchor } from "./SpeechAnchor";

const CELL_X = 1.8;

export function Cells({ avatar, result }: { avatar: AvatarId; result: RoundResult | undefined }) {
  const youJailed = (result?.player_years ?? 1) > 0;
  const tungJailed = (result?.partner_years ?? 1) > 0;

  return (
    <group>
      <ambientLight intensity={0.35} color="#a5b4fc" />
      <pointLight position={[-CELL_X, 2.8, 0]} intensity={5} distance={5} color="#e2e8f0" />
      <pointLight position={[CELL_X, 2.8, 0]} intensity={5} distance={5} color="#e2e8f0" />
      <pointLight position={[0, 2, 3]} intensity={6} distance={7} color="#38bdf8" />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 1]} receiveShadow>
        <planeGeometry args={[9, 7]} />
        <meshStandardMaterial color="#1c1f26" />
      </mesh>
      <Box size={[7.4, 3, 0.1]} position={[0, 1.5, -1.5]} color="#4a5160" />
      <Box size={[0.15, 3, 2.4]} position={[0, 1.5, -0.3]} color="#3b414d" />
      <Box size={[0.15, 3, 2.4]} position={[-3.65, 1.5, -0.3]} color="#3b414d" />
      <Box size={[0.15, 3, 2.4]} position={[3.65, 1.5, -0.3]} color="#3b414d" />

      {[-CELL_X, CELL_X].map((cx) => (
        <group key={cx}>
          {/* bunk */}
          <Box size={[1.4, 0.12, 0.6]} position={[cx + 0.6, 0.5, -1.1]} color="#64748b" />
          {/* bars + top rail */}
          {Array.from({ length: 9 }, (_, i) => (
            <Cyl key={i} top={0.03} bottom={0.03} h={2.9} position={[cx - 1.6 + i * 0.4, 1.45, 0.9]} color="#9ca3af" />
          ))}
          <Box size={[3.4, 0.1, 0.1]} position={[cx, 2.9, 0.9]} color="#6b7280" />
        </group>
      ))}

      {/* the player */}
      <AnimalSamurai avatar={avatar} position={youJailed ? [-CELL_X, 0, -0.1] : [-CELL_X, 0, 2]} scale={1.05} />
      <Label3D position={[-CELL_X, 3.35, 0.9]} title="You" subtitle={sentenceText(result?.player_years)} accent="#c084fc" />

      {/* Tung Tung Tung Sahur */}
      <TungTung position={tungJailed ? [CELL_X, 0, -0.2] : [CELL_X, 0, 2]} rotation={[0, -0.3, 0]} scale={0.85} swinging={!tungJailed} />
      <Label3D position={[CELL_X, 3.35, 0.9]} title="Tung Tung Tung Sahur" subtitle={sentenceText(result?.partner_years)} accent="#e3a86b" />

      {/* Nash-sensei floats in the corridor */}
      <Kitsune position={[0, 0, 2.6]} scale={0.72} />
      <group position={[0, 0, 2.6]}>
        <SpeechAnchor id="tutor" offset={[0, 1.95, 0]} />
      </group>
      <group position={tungJailed ? [CELL_X, 0, -0.2] : [CELL_X, 0, 2]}>
        <SpeechAnchor id="partner" offset={[0, 2.0, 0]} />
      </group>
    </group>
  );
}

function sentenceText(years: number | undefined): string | undefined {
  if (years === undefined) return undefined;
  return years === 0 ? "FREE! 0 years" : `${years} year${years > 1 ? "s" : ""}`;
}
