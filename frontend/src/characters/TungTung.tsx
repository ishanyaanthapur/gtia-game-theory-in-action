// Tung Tung Tung Sahur: low-poly tribute to the 2025 Indonesian meme (a living wooden kentongan
// drum with huge staring eyes, stick limbs, bare feet, and a baseball bat).
import { useRef } from "react";
import { useFrame, type ThreeElements } from "@react-three/fiber";
import type { Group } from "three";
import { Ball, Box, Cyl, Ring } from "./parts";

const WOOD = "#c08a53";
const WOOD_DARK = "#8a5a2b";
const BAT = "#e3c38f";
const INK = "#111111";

export function TungTung({ swinging = false, ...group }: ThreeElements["group"] & { swinging?: boolean }) {
  const batArm = useRef<Group>(null);
  const root = useRef<Group>(null);
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (batArm.current) batArm.current.rotation.z = swinging ? -0.6 + Math.sin(t * 8) * 0.6 : -0.35 + Math.sin(t * 1.5) * 0.05;
    if (root.current) root.current.position.y = swinging ? Math.abs(Math.sin(t * 8)) * 0.05 : 0;
  });

  return (
    <group {...group}>
      <group ref={root}>
        {/* bare feet + stick legs */}
        <Ball r={0.08} position={[-0.12, 0.03, 0.06]} scale={[1, 0.45, 1.6]} color={WOOD} />
        <Ball r={0.08} position={[0.12, 0.03, 0.06]} scale={[1, 0.45, 1.6]} color={WOOD} />
        <Cyl top={0.035} bottom={0.035} h={0.36} position={[-0.12, 0.2, 0]} color={WOOD} />
        <Cyl top={0.035} bottom={0.035} h={0.36} position={[0.12, 0.2, 0]} color={WOOD} />

        {/* the tall log body with grain rings + kentongan slit */}
        <Cyl top={0.3} bottom={0.32} h={1.55} position={[0, 1.15, 0]} color={WOOD} />
        <Cyl top={0.3} bottom={0.3} h={0.02} position={[0, 1.93, 0]} color={WOOD_DARK} />
        {[0.55, 0.85, 1.6].map((y) => (
          <Ring key={y} r={0.315} tube={0.012} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]} color={WOOD_DARK} />
        ))}
        <Box size={[0.05, 0.4, 0.02]} position={[0.1, 0.75, 0.31]} color={WOOD_DARK} />

        {/* huge staring eyes, brows, wide grin */}
        {[-0.13, 0.13].map((x) => (
          <group key={x} position={[x, 1.55, 0.27]}>
            <Ball r={0.115} scale={[1, 1.15, 0.6]} color="#ffffff" />
            <Ball r={0.05} position={[0, -0.01, 0.06]} color={INK} />
            <Ball r={0.015} position={[0.02, 0.02, 0.1]} color="#ffffff" />
            <Box size={[0.17, 0.035, 0.03]} position={[0, 0.17, 0.02]} rotation={[0, 0, x > 0 ? -0.2 : 0.2]} color={INK} />
          </group>
        ))}
        <Ball r={0.035} position={[0, 1.4, 0.31]} color={WOOD_DARK} />
        <Box size={[0.26, 0.05, 0.03]} position={[0, 1.28, 0.3]} color={INK} />
        <Box size={[0.22, 0.03, 0.03]} position={[0, 1.26, 0.305]} color="#7f1d1d" />

        {/* stick arms */}
        <Cyl top={0.03} bottom={0.03} h={0.55} position={[-0.42, 1.0, 0]} rotation={[0, 0, -0.5]} color={WOOD} />
        <Ball r={0.05} position={[-0.54, 0.77, 0]} color={WOOD} />
        <group ref={batArm} position={[0.3, 1.2, 0]}>
          <Cyl top={0.03} bottom={0.03} h={0.55} position={[0.13, -0.24, 0]} rotation={[0, 0, 0.5]} color={WOOD} />
          <group position={[0.26, -0.47, 0.02]} rotation={[0.2, 0, -0.3]}>
            <Ball r={0.05} color={WOOD} />
            {/* baseball bat */}
            <Cyl top={0.075} bottom={0.025} h={0.95} position={[0, 0.45, 0]} color={BAT} />
            <Cyl top={0.035} bottom={0.035} h={0.03} position={[0, -0.04, 0]} color={WOOD_DARK} />
          </group>
        </group>
      </group>
    </group>
  );
}
