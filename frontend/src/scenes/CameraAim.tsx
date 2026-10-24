import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Vector3, type PerspectiveCamera } from "three";

/** Point the camera at a scene's focus point (Canvas cameras otherwise look straight down -z). */
export function CameraAim({ target }: { target: [number, number, number] }) {
  const { camera } = useThree();
  const [x, y, z] = target;
  useEffect(() => camera.lookAt(x, y, z), [camera, x, y, z]);
  return null;
}

/** Glide the camera to a new position/focus when the scene changes (one Canvas, many scenes).
 *  hfov keeps the same HORIZONTAL view in tall/narrow windows, so the sides don't get cropped. */
export function CameraRig({
  position,
  target,
  hfov = 62,
}: {
  position: [number, number, number];
  target: [number, number, number];
  hfov?: number;
}) {
  const { camera, size } = useThree();
  const goalPos = useRef(new Vector3(...position));
  const goalLook = useRef(new Vector3(...target));
  const look = useRef(new Vector3(...target));
  const first = useRef(true);

  useEffect(() => {
    goalPos.current.set(...position);
    goalLook.current.set(...target);
    if (first.current) {
      first.current = false;
      camera.position.copy(goalPos.current);
      look.current.copy(goalLook.current);
      camera.lookAt(look.current);
    }
  }, [camera, position, target]);

  useFrame((_, dt) => {
    const cam = camera as PerspectiveCamera;
    const aspect = size.width / Math.max(1, size.height);
    const v = (2 * Math.atan(Math.tan((hfov * Math.PI) / 360) / aspect) * 180) / Math.PI;
    const fov = Math.min(85, Math.max(40, v));
    if (Math.abs(cam.fov - fov) > 0.1) {
      cam.fov += (fov - cam.fov) * Math.min(1, dt * 4);
      cam.updateProjectionMatrix();
    }
    const k = 1 - Math.pow(0.02, dt);
    camera.position.lerp(goalPos.current, k);
    look.current.lerp(goalLook.current, k);
    camera.lookAt(look.current);
  });
  return null;
}
