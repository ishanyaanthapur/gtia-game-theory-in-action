// Nash-sensei: a kitsune sage (fox spirit) in indigo robes, many glowing tails, staff + foxfire.
import { useRef } from "react";
import { useFrame, type ThreeElements } from "@react-three/fiber";
import type { Group } from "three";
import { Ball, Box, Cone, Cyl, Ring } from "./parts";

const FUR = "#eef0f6";
const ROBE = "#312e81";
const GOLD = "#e7c768";
const FIRE = "#38bdf8";
const MARK = "#dc2626";
const TAILS = 7;

export function Kitsune(group: ThreeElements["group"]) {
  const root = useRef<Group>(null);
  const tails = useRef<Group>(null);
  const fire = useRef<Group>(null);
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (root.current) root.current.position.y = 0.25 + Math.sin(t * 1.4) * 0.08; // floats
    if (tails.current)
      tails.current.children.forEach((c, i) => (c.rotation.z = c.userData.base + Math.sin(t * 1.8 + i) * 0.08));
    if (fire.current) fire.current.rotation.y = t * 0.9;
  });

  return (
    <group {...group}>
      <group ref={root}>
        {/* fanned tails with glowing tips */}
        <group ref={tails} position={[0, 0.55, -0.25]}>
          {Array.from({ length: TAILS }, (_, i) => {
            const base = ((i - (TAILS - 1) / 2) / (TAILS - 1)) * 2.2;
            return (
              <group key={i} rotation={[-0.35, 0, base]} userData={{ base }}>
                <Ball r={0.14} position={[0, 0.45, 0]} scale={[0.8, 3.2, 0.8]} color={FUR} />
                <Ball r={0.12} position={[0, 0.88, 0]} scale={[0.8, 1.2, 0.8]} color={FIRE} emissive={FIRE} />
              </group>
            );
          })}
        </group>

        {/* robe with gold trim + obi sash */}
        <Cone r={0.5} h={1.2} position={[0, 0.6, 0]} color={ROBE} />
        <Ring r={0.49} tube={0.03} position={[0, 0.04, 0]} rotation={[Math.PI / 2, 0, 0]} color={GOLD} />
        <Cyl top={0.24} bottom={0.29} h={0.12} position={[0, 0.75, 0]} color={GOLD} />
        <Box size={[0.06, 0.55, 0.02]} position={[0, 0.95, 0.19]} rotation={[0, 0, 0]} color={GOLD} />
        {/* sleeves */}
        <Cone r={0.17} h={0.5} position={[-0.32, 0.85, 0.05]} rotation={[0, 0, 0.6]} color={ROBE} />
        <Cone r={0.17} h={0.5} position={[0.32, 0.85, 0.05]} rotation={[0, 0, -0.6]} color={ROBE} />

        {/* staff with glowing orb */}
        <group position={[0.5, 0.75, 0.15]}>
          <Ball r={0.07} position={[-0.04, 0, 0]} color={FUR} />
          <Cyl top={0.025} bottom={0.03} h={1.5} position={[0, 0.15, 0]} color="#6b4423" />
          <Ring r={0.1} tube={0.02} position={[0, 0.95, 0]} color={GOLD} />
          <Ball r={0.08} position={[0, 0.95, 0]} color={FIRE} emissive={FIRE} />
          <pointLight position={[0, 0.95, 0.1]} color={FIRE} intensity={2.5} distance={3} />
        </group>

        {/* fox head */}
        <group position={[0, 1.35, 0]}>
          <Ball r={0.26} scale={[1.05, 0.95, 1]} color={FUR} />
          <Cone r={0.13} h={0.3} position={[0, -0.06, 0.3]} rotation={[Math.PI / 2, 0, 0]} color={FUR} />
          <Ball r={0.035} position={[0, -0.06, 0.45]} color="#111111" />
          {/* ears */}
          {[-1, 1].map((side) => (
            <group key={side} position={[side * 0.15, 0.25, -0.02]} rotation={[0, 0, -side * 0.25]}>
              <Cone r={0.09} h={0.26} color={FUR} />
              <Cone r={0.05} h={0.17} position={[0, -0.02, 0.04]} color={MARK} />
            </group>
          ))}
          {/* narrow wise golden eyes + red kitsune markings */}
          {[-1, 1].map((side) => (
            <group key={side}>
              <Box size={[0.09, 0.025, 0.02]} position={[side * 0.1, 0.05, 0.24]} rotation={[0, 0, side * 0.25]} color={GOLD} emissive={GOLD} />
              <Box size={[0.03, 0.12, 0.02]} position={[side * 0.17, 0.12, 0.2]} rotation={[0, 0, side * 0.5]} color={MARK} />
            </group>
          ))}
          {/* sage's beard tuft */}
          <Cone r={0.07} h={0.22} position={[0, -0.25, 0.18]} rotation={[Math.PI, 0, 0]} color={FUR} />
        </group>

        {/* orbiting foxfire */}
        <group ref={fire} position={[0, 0.9, 0]}>
          {Array.from({ length: 5 }, (_, i) => {
            const a = (i / 5) * Math.PI * 2;
            return <Ball key={i} r={0.06} position={[Math.cos(a) * 0.85, Math.sin(a * 2) * 0.2, Math.sin(a) * 0.85]} color={FIRE} emissive={FIRE} />;
          })}
        </group>
      </group>
    </group>
  );
}
