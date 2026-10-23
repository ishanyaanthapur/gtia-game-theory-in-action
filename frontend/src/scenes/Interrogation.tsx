// Interrogation room: Detective Byte across the table, Tung Tung visible through the window.
import { Label3D } from "./Label3D";
import { AnimalSamurai } from "../characters/AnimalSamurai";
import { Cop } from "../characters/Cop";
import { TungTung } from "../characters/TungTung";
import { Box, Cone, Cyl } from "../characters/parts";
import type { AvatarId } from "../types";

const WALL = "#3b4252";
const WALL_DARK = "#2e3440";

export function Interrogation({ avatar, copTalking }: { avatar: AvatarId; copTalking: boolean }) {
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
      {/* left wall with a one-way window into Tung Tung's room */}
      <Box size={[0.1, 3.5, 1.5]} position={[-4, 1.75, -3.25]} color={WALL_DARK} />
      <Box size={[0.1, 3.5, 4.5]} position={[-4, 1.75, 1.75]} color={WALL_DARK} />
      <Box size={[0.1, 1, 2]} position={[-4, 0.5, -1.5]} color={WALL_DARK} />
      <Box size={[0.1, 1.1, 2]} position={[-4, 2.95, -1.5]} color={WALL_DARK} />
      <mesh position={[-4, 1.7, -1.5]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[2, 1.4]} />
        <meshStandardMaterial color="#93c5fd" transparent opacity={0.12} />
      </mesh>
      <Label3D position={[-3.85, 2.75, -1.5]} title="Room B" subtitle="Tung Tung Tung Sahur" accent="#e3a86b" width={1.5} />

      {/* Tung Tung's room next door */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-6, 0, -1.5]}>
        <planeGeometry args={[4, 4]} />
        <meshStandardMaterial color="#2a1f1a" />
      </mesh>
      <Box size={[0.1, 3.5, 4]} position={[-8, 1.75, -1.5]} color="#3a2a22" />
      <pointLight position={[-6, 2.6, -1.5]} color="#ff9b6a" intensity={6} distance={5} />
      <TungTung position={[-5.6, 0, -1.6]} rotation={[0, Math.PI / 2, 0]} scale={0.9} />

      {/* table + chairs */}
      <Box size={[2.4, 0.08, 1.3]} position={[0, 0.78, 0]} color="#4b5563" />
      {[-1.1, 1.1].flatMap((x) => [-0.55, 0.55].map((z) => <Box key={`${x}${z}`} size={[0.06, 0.78, 0.06]} position={[x, 0.39, z]} color="#374151" />))}
      <Box size={[0.3, 0.02, 0.22]} position={[0.5, 0.83, 0.1]} rotation={[0, 0.3, 0]} color="#f5f5dc" />
      <Box size={[0.6, 0.9, 0.08]} position={[0, 0.95, -1.75]} color="#1f2937" />
      <Box size={[0.6, 0.06, 0.55]} position={[0, 0.5, -1.5]} color="#1f2937" />

      {/* Detective Byte, seated (legs hidden below the floor) */}
      <Cop position={[0, -0.35, -1.3]} talking={copTalking} />

      {/* the player on a stool, back to camera */}
      <Cyl top={0.3} bottom={0.3} h={0.45} position={[0, 0.22, 1.25]} color="#1f2937" />
      <AnimalSamurai avatar={avatar} position={[0, 0.45, 1.25]} rotation={[0, Math.PI, 0]} scale={1.1} />
    </group>
  );
}
