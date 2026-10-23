// Projects a 3D point (e.g. above a character's head) to stage pixels every frame, so a plain DOM
// speech bubble can follow a moving character without drei <Html> (which crashed on remounts).
import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Vector3, type Group } from "three";

export type Speaker = "cop" | "partner" | "tutor";
export const anchors: Partial<Record<Speaker, { x: number; y: number; visible: boolean }>> = {};

export function SpeechAnchor({ id, offset = [0, 0, 0] }: { id: Speaker; offset?: [number, number, number] }) {
  const ref = useRef<Group>(null);
  const v = useRef(new Vector3());
  const { camera, size } = useThree();
  useFrame(() => {
    if (!ref.current) return;
    ref.current.getWorldPosition(v.current);
    v.current.project(camera);
    anchors[id] = {
      x: ((v.current.x + 1) / 2) * size.width,
      y: ((1 - v.current.y) / 2) * size.height,
      visible: v.current.z < 1,
    };
  });
  return <group ref={ref} position={offset} />;
}

export function clearAnchors() {
  for (const k of Object.keys(anchors)) delete anchors[k as Speaker];
}
