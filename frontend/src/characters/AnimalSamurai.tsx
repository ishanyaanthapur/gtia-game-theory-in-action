// Player avatars: chibi anthropomorphic animal samurai, built from primitives.
import { useRef } from "react";
import { useFrame, type ThreeElements } from "@react-three/fiber";
import type { Group } from "three";
import { AVATARS } from "./avatars";
import type { AvatarId } from "../types";
import { Ball, Box, Capsule, Cone, Cyl, Ring } from "./parts";

const INK = "#18181b";

type Props = ThreeElements["group"] & {
  avatar: AvatarId;
  walking?: boolean;
  bob?: boolean;
  seated?: boolean; // sitting on a chair: thighs forward, shins down (feet on the floor)
};

export function AnimalSamurai({ avatar, walking = false, bob = true, seated = false, ...group }: Props) {
  const s = AVATARS[avatar];
  const body = useRef<Group>(null);
  const tail = useRef<Group>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (body.current) {
      const speed = walking ? 10 : 2;
      const amp = walking ? 0.06 : bob ? 0.025 : 0;
      body.current.position.y = Math.abs(Math.sin(t * speed)) * amp;
      body.current.rotation.z = walking ? Math.sin(t * speed) * 0.06 : 0;
    }
    if (tail.current) {
      const wag = s.tail === "wag" ? Math.sin(t * 9) * 0.5 : Math.sin(t * 1.6) * 0.25;
      tail.current.rotation.y = wag;
    }
  });

  return (
    <group {...group}>
      <group ref={body}>
        {seated ? (
          <>
            {/* seated: hakama hips, thighs forward, shins down, feet on the floor */}
            <Cyl top={0.27} bottom={0.3} h={0.16} position={[0, 0.5, 0]} color={shade(s.armor, -0.45)} />
            {[-0.13, 0.13].map((x) => (
              <group key={x}>
                <Capsule r={0.11} len={0.3} position={[x, 0.47, 0.2]} rotation={[Math.PI / 2, 0, 0]} color={shade(s.armor, -0.45)} />
                <Capsule r={0.09} len={0.26} position={[x, 0.25, 0.4]} color={shade(s.armor, -0.45)} />
                <Ball r={0.1} position={[x, 0.05, 0.46]} scale={[1, 0.6, 1.3]} color={s.limbs} />
              </group>
            ))}
          </>
        ) : (
          <>
            {/* feet + hakama */}
            <Ball r={0.11} position={[-0.14, 0.06, 0.06]} scale={[1, 0.6, 1.3]} color={s.limbs} />
            <Ball r={0.11} position={[0.14, 0.06, 0.06]} scale={[1, 0.6, 1.3]} color={s.limbs} />
            <Cyl top={0.27} bottom={0.36} h={0.42} position={[0, 0.3, 0]} color={shade(s.armor, -0.45)} />
          </>
        )}

        {/* torso: fur + dō chest plate with trim */}
        <Capsule r={0.27} len={0.22} position={[0, 0.66, 0]} color={s.fur} />
        <Cyl top={0.29} bottom={0.31} h={0.34} position={[0, 0.66, 0.01]} color={s.armor} />
        <Ring r={0.31} tube={0.025} position={[0, 0.5, 0.01]} rotation={[Math.PI / 2, 0, 0]} color={s.trim} />
        <Ring r={0.29} tube={0.02} position={[0, 0.83, 0.01]} rotation={[Math.PI / 2, 0, 0]} color={s.trim} />
        {/* sode shoulder plates */}
        <Box size={[0.24, 0.06, 0.26]} position={[-0.33, 0.84, 0]} rotation={[0, 0, 0.45]} color={s.armor} />
        <Box size={[0.24, 0.06, 0.26]} position={[0.33, 0.84, 0]} rotation={[0, 0, -0.45]} color={s.armor} />

        {/* arms + paws */}
        <Capsule r={0.075} len={0.26} position={[-0.36, 0.62, 0.02]} rotation={[0, 0, 0.18]} color={s.limbs} />
        <Capsule r={0.075} len={0.26} position={[0.36, 0.62, 0.02]} rotation={[0, 0, -0.18]} color={s.limbs} />
        <Ball r={0.085} position={[-0.39, 0.45, 0.04]} color={s.limbs} />
        <Ball r={0.085} position={[0.39, 0.45, 0.04]} color={s.limbs} />

        {/* katana at the left hip */}
        <group position={[-0.3, 0.5, -0.05]} rotation={[0.25, 0, 1.25]}>
          <Cyl top={0.025} bottom={0.025} h={0.22} position={[0, 0.22, 0]} color={INK} />
          <Cyl top={0.06} bottom={0.06} h={0.015} position={[0, 0.11, 0]} color="#d4af37" />
          <Box size={[0.035, 0.6, 0.012]} position={[0, -0.2, 0]} color="#e5e7eb" />
        </group>

        {/* head */}
        <group position={[0, 1.2, 0]}>
          <Ball r={0.36} color={s.fur} />
          {s.ears === "panda" && (
            <>
              {/* panda eye patches */}
              <Ball r={0.1} position={[-0.13, 0.04, 0.29]} scale={[0.9, 1.25, 0.5]} rotation={[0, 0, 0.5]} color={INK} />
              <Ball r={0.1} position={[0.13, 0.04, 0.29]} scale={[0.9, 1.25, 0.5]} rotation={[0, 0, -0.5]} color={INK} />
            </>
          )}
          {/* muzzle + nose */}
          <Ball r={0.15} position={[0, -0.08, 0.27]} scale={[1.2, 0.85, 0.9]} color={s.muzzle} />
          <Ball r={0.045} position={[0, -0.02, 0.4]} scale={[1.3, 0.9, 1]} color={avatar === "yoshi" ? "#f472b6" : INK} />
          {avatar === "jujubee" && <Ball r={0.05} position={[0, -0.17, 0.36]} scale={[1, 0.7, 0.6]} color="#f472b6" />}
          {/* eyes */}
          {[-0.13, 0.13].map((x) => (
            <group key={x} position={[x, 0.05, 0.31]}>
              <Ball r={0.055} color={INK} />
              <Ball r={0.018} position={[0.015, 0.02, 0.045]} color="#ffffff" />
            </group>
          ))}
          {/* tabby stripes on the forehead */}
          {s.stripes &&
            [-0.08, 0, 0.08].map((x) => (
              <Box key={x} size={[0.03, 0.12, 0.02]} position={[x, 0.27, 0.22]} rotation={[-0.7, 0, 0]} color={s.stripes!} />
            ))}
          {/* hachimaki headband */}
          <Ring r={0.352} tube={0.035} position={[0, 0.1, -0.02]} rotation={[Math.PI / 2 - 0.25, 0, 0]} color={s.headband} />
          <Box size={[0.05, 0.22, 0.02]} position={[0.08, 0.04, -0.36]} rotation={[0.2, 0, 0.5]} color={s.headband} />
          <Box size={[0.05, 0.2, 0.02]} position={[-0.04, 0.03, -0.37]} rotation={[0.2, 0, -0.4]} color={s.headband} />
          <Ears style={s.ears} fur={s.fur} earColor={s.earColor} />
        </group>

        {/* tail */}
        <group ref={tail} position={[0, 0.45, -0.3]}>
          <Tail kind={s.tail} fur={s.fur} stripe={s.muzzle} />
        </group>
      </group>
    </group>
  );
}

function Ears({ style, fur, earColor }: { style: "cat" | "floppy" | "panda"; fur: string; earColor?: string }) {
  if (style === "cat")
    return (
      <>
        {[-1, 1].map((side) => (
          <group key={side} position={[side * 0.2, 0.3, 0]} rotation={[0, 0, -side * 0.35]}>
            <Cone r={0.12} h={0.24} color={fur} />
            <Cone r={0.07} h={0.15} position={[0, -0.02, 0.05]} color="#f9a8d4" />
          </group>
        ))}
      </>
    );
  if (style === "floppy")
    return (
      <>
        {[-1, 1].map((side) => (
          <Ball
            key={side}
            r={0.13}
            position={[side * 0.34, 0.02, 0]}
            scale={[0.55, 1.5, 0.8]}
            rotation={[0, 0, side * 0.35]}
            color={earColor ?? fur}
          />
        ))}
      </>
    );
  return (
    <>
      {[-1, 1].map((side) => (
        <Ball key={side} r={0.11} position={[side * 0.25, 0.29, -0.02]} color={INK} />
      ))}
    </>
  );
}

function Tail({ kind, fur, stripe }: { kind: "striped" | "wag" | "stub"; fur: string; stripe: string }) {
  if (kind === "stub") return <Ball r={0.09} color={fur} />;
  if (kind === "wag") return <Capsule r={0.06} len={0.3} position={[0, 0.12, -0.08]} rotation={[-0.8, 0, 0]} color={fur} />;
  // striped tabby tail: alternating orange/white segments curling upward
  return (
    <>
      {Array.from({ length: 8 }, (_, i) => {
        const a = (i / 7) * 1.6;
        return (
          <Ball
            key={i}
            r={0.065 - i * 0.002}
            position={[0, Math.sin(a) * 0.45 - 0.05, -Math.cos(a) * 0.1 - i * 0.045]}
            color={i % 2 === 0 ? fur : stripe}
          />
        );
      })}
    </>
  );
}

/** Lighten (amt > 0) or darken (amt < 0) a hex color. */
export function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number) => Math.round(Math.min(255, Math.max(0, amt < 0 ? v * (1 + amt) : v + (255 - v) * amt)));
  const r = ch(n >> 16),
    g = ch((n >> 8) & 255),
    b = ch(n & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}
