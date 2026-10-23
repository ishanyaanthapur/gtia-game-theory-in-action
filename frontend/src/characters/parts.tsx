// Small helpers so the character files read like a parts list.
import type { ReactNode } from "react";
import type { Euler, Vector3 } from "@react-three/fiber";

export type V3 = [number, number, number];

export function Toon({ color, emissive, intensity = 1 }: { color: string; emissive?: string; intensity?: number }) {
  return <meshToonMaterial color={color} emissive={emissive ?? "#000000"} emissiveIntensity={emissive ? intensity : 0} />;
}

interface PartProps {
  position?: Vector3;
  rotation?: Euler;
  scale?: Vector3;
  color: string;
  emissive?: string;
  children?: ReactNode;
}

export function Ball({ r = 1, segments = 24, ...p }: PartProps & { r?: number; segments?: number }) {
  return (
    <mesh position={p.position} rotation={p.rotation} scale={p.scale} castShadow>
      <sphereGeometry args={[r, segments, segments]} />
      <Toon color={p.color} emissive={p.emissive} />
    </mesh>
  );
}

export function Cyl({
  top = 0.1,
  bottom = 0.1,
  h = 1,
  segments = 20,
  ...p
}: PartProps & { top?: number; bottom?: number; h?: number; segments?: number }) {
  return (
    <mesh position={p.position} rotation={p.rotation} scale={p.scale} castShadow>
      <cylinderGeometry args={[top, bottom, h, segments]} />
      <Toon color={p.color} emissive={p.emissive} />
    </mesh>
  );
}

export function Box({ size = [1, 1, 1], ...p }: PartProps & { size?: V3 }) {
  return (
    <mesh position={p.position} rotation={p.rotation} scale={p.scale} castShadow>
      <boxGeometry args={size} />
      <Toon color={p.color} emissive={p.emissive} />
    </mesh>
  );
}

export function Capsule({ r = 0.1, len = 0.3, ...p }: PartProps & { r?: number; len?: number }) {
  return (
    <mesh position={p.position} rotation={p.rotation} scale={p.scale} castShadow>
      <capsuleGeometry args={[r, len, 8, 16]} />
      <Toon color={p.color} emissive={p.emissive} />
    </mesh>
  );
}

export function Cone({ r = 0.1, h = 0.3, segments = 16, ...p }: PartProps & { r?: number; h?: number; segments?: number }) {
  return (
    <mesh position={p.position} rotation={p.rotation} scale={p.scale} castShadow>
      <coneGeometry args={[r, h, segments]} />
      <Toon color={p.color} emissive={p.emissive} />
    </mesh>
  );
}

export function Ring({ r = 0.3, tube = 0.03, ...p }: PartProps & { r?: number; tube?: number }) {
  return (
    <mesh position={p.position} rotation={p.rotation} scale={p.scale}>
      <torusGeometry args={[r, tube, 10, 32]} />
      <Toon color={p.color} emissive={p.emissive} />
    </mesh>
  );
}
