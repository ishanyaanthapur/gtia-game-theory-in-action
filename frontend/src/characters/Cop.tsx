// Detective Byte: a human American city cop.
import { useRef } from "react";
import { useFrame, type ThreeElements } from "@react-three/fiber";
import type { Group } from "three";
import { Ball, Box, Capsule, Cyl } from "./parts";

const SKIN = "#e0ac7e";
const NAVY = "#1e3a8a";
const NAVY_DARK = "#172554";
const GOLD = "#facc15";
const HAIR = "#5b3a1e";

export function Cop({ talking = false, ...group }: ThreeElements["group"] & { talking?: boolean }) {
  const head = useRef<Group>(null);
  const arm = useRef<Group>(null);
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (head.current) head.current.rotation.z = talking ? Math.sin(t * 6) * 0.05 : Math.sin(t * 0.8) * 0.02;
    if (arm.current) arm.current.rotation.x = -0.9 + Math.sin(t * 0.7) * 0.08; // sips coffee
  });

  return (
    <group {...group}>
      {/* legs + shoes */}
      <Capsule r={0.12} len={0.55} position={[-0.15, 0.42, 0]} color={NAVY_DARK} />
      <Capsule r={0.12} len={0.55} position={[0.15, 0.42, 0]} color={NAVY_DARK} />
      <Box size={[0.2, 0.1, 0.32]} position={[-0.15, 0.05, 0.06]} color="#0a0a0a" />
      <Box size={[0.2, 0.1, 0.32]} position={[0.15, 0.05, 0.06]} color="#0a0a0a" />
      {/* torso: uniform shirt, belt, badge, tie */}
      <Box size={[0.62, 0.72, 0.36]} position={[0, 1.1, 0]} color={NAVY} />
      <Box size={[0.64, 0.08, 0.38]} position={[0, 0.76, 0]} color="#111827" />
      <Box size={[0.08, 0.06, 0.39]} position={[0, 0.76, 0]} color={GOLD} />
      <Cyl top={0.055} bottom={0.055} h={0.02} segments={5} position={[-0.16, 1.28, 0.19]} rotation={[Math.PI / 2, 0, 0]} color={GOLD} />
      <Box size={[0.07, 0.38, 0.02]} position={[0, 1.18, 0.185]} color="#0f172a" />
      {/* shoulders + left arm resting */}
      <Ball r={0.13} position={[-0.36, 1.38, 0]} color={NAVY} />
      <Ball r={0.13} position={[0.36, 1.38, 0]} color={NAVY} />
      <Capsule r={0.1} len={0.45} position={[-0.4, 1.1, 0.08]} rotation={[-0.4, 0, 0.1]} color={NAVY} />
      <Ball r={0.085} position={[-0.42, 0.86, 0.22]} color={SKIN} />
      {/* right arm holding coffee */}
      <group ref={arm} position={[0.38, 1.36, 0]}>
        <Capsule r={0.1} len={0.4} position={[0, -0.25, 0]} color={NAVY} />
        <group position={[0, -0.5, 0]}>
          <Ball r={0.085} color={SKIN} />
          <Cyl top={0.07} bottom={0.055} h={0.17} position={[0, 0.02, 0.1]} rotation={[0.9, 0, 0]} color="#f8fafc" />
          <Cyl top={0.072} bottom={0.072} h={0.03} position={[0, 0.07, 0.17]} rotation={[0.9, 0, 0]} color="#7c2d12" />
        </group>
      </group>
      {/* head */}
      <group ref={head} position={[0, 1.72, 0]}>
        <Cyl top={0.1} bottom={0.11} h={0.14} position={[0, -0.18, 0]} color={SKIN} />
        <Ball r={0.26} scale={[1, 1.1, 1]} color={SKIN} />
        <Ball r={0.06} position={[-0.26, 0, 0]} color={SKIN} />
        <Ball r={0.06} position={[0.26, 0, 0]} color={SKIN} />
        {[-0.09, 0.09].map((x) => (
          <group key={x}>
            <Ball r={0.032} position={[x, 0.04, 0.23]} color="#0a0a0a" />
            <Box size={[0.1, 0.025, 0.02]} position={[x, 0.11, 0.23]} rotation={[0, 0, x > 0 ? 0.25 : -0.25]} color={HAIR} />
          </group>
        ))}
        <Ball r={0.05} position={[0, -0.03, 0.27]} color="#d4946a" />
        {/* mustache */}
        <Capsule r={0.035} len={0.16} position={[0, -0.1, 0.24]} rotation={[0, 0, Math.PI / 2]} color={HAIR} />
        <Box size={[0.1, 0.02, 0.02]} position={[0, -0.17, 0.235]} color="#9f1239" />
        {/* police cap */}
        <Cyl top={0.3} bottom={0.25} h={0.13} position={[0, 0.25, 0]} color={NAVY_DARK} />
        <Box size={[0.36, 0.025, 0.18]} position={[0, 0.19, 0.2]} rotation={[0.2, 0, 0]} color="#0a0a0a" />
        <Cyl top={0.05} bottom={0.05} h={0.02} segments={6} position={[0, 0.27, 0.27]} rotation={[Math.PI / 2 - 0.2, 0, 0]} color={GOLD} />
      </group>
    </group>
  );
}
