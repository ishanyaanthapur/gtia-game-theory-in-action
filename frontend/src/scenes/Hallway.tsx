// The hall of doors. Walk with WASD/arrow keys, or click a door to walk to it.
import { useEffect, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Vector3, type Group } from "three";
import { AnimalSamurai } from "../characters/AnimalSamurai";
import { AVATARS } from "../characters/avatars";
import { Box } from "../characters/parts";
import type { AvatarId } from "../types";
import { Label3D } from "./Label3D";
import { MangaPoster } from "./MangaPoster";

interface DoorDef {
  id: number;
  title: string;
  game: string;
  open: boolean;
  pos: [number, number, number]; // door center on the wall
  facing: number; // y rotation
  stand: [number, number]; // x,z where the player stands to enter
  color: string;
}

const DOORS: DoorDef[] = [
  { id: 1, title: "Dilemma Detectives", game: "Prisoner's Dilemma", open: true, pos: [-2.95, 1.25, -4], facing: Math.PI / 2, stand: [-1.9, -4], color: "#3b82f6" },
  { id: 2, title: "Stag Hunt", game: "Coordination game", open: false, pos: [2.95, 1.25, -8], facing: -Math.PI / 2, stand: [1.9, -8], color: "#22c55e" },
  { id: 3, title: "The Ultimatum", game: "Bargaining game", open: false, pos: [0, 1.25, -13.9], facing: 0, stand: [0, -12.8], color: "#f59e0b" },
];

const HALF_W = 2.5;
const Z_MIN = -12.9;
const Z_MAX = 2.5;
const SPEED = 3.2;

export function Hallway({ avatar, onEnter, onBack }: { avatar: AvatarId; onEnter: () => void; onBack: () => void }) {
  const [near, setNear] = useState<DoorDef | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const target = useRef<[number, number] | null>(null);

  const tryEnter = (door: DoorDef | null) => {
    if (!door) return;
    if (door.open) onEnter();
    else {
      setToast(`🔒 ${door.title} is coming soon. Try Door 1!`);
      setTimeout(() => setToast(null), 2200);
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "Enter" || e.key.toLowerCase() === "e") && near) tryEnter(near);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div className="screen">
      <div className="canvas-wrap">
        <Canvas shadows camera={{ position: [0, 2.8, 6], fov: 55 }}>
          <color attach="background" args={["#07040d"]} />
          <fog attach="fog" args={["#07040d", 8, 22]} />
          <ambientLight intensity={0.9} />
          <hemisphereLight args={["#c4b5fd", "#1e1030", 0.6]} />
          <Corridor />
          {DOORS.map((d) => (
            <Door key={d.id} door={d} avatar={avatar} highlighted={near?.id === d.id} onClick={() => (target.current = d.stand)} />
          ))}
          {DOORS.map((d) => (
            <DoorLabel key={d.id} door={d} />
          ))}
          <Player avatar={avatar} target={target} onNear={setNear} />
        </Canvas>
      </div>

      <div className="hud-top">
        <button className="ghost pill" onClick={onBack}>← Change avatar</button>
        <span className="pill hall-title">⚖️ Equilibrium Hall</span>
        <span className="pill">
          Playing as <b>{AVATARS[avatar].name}</b> · {AVATARS[avatar].species}
        </span>
      </div>

      {toast && <div className="banner">{toast}</div>}

      <div className="hint">
        {near ? (
          <>
            <b style={{ color: "var(--text)" }}>Door {near.id}: {near.title}</b>. Press <kbd>E</kbd> or{" "}
            <button className="primary" style={{ padding: "4px 12px", marginLeft: 6 }} onClick={() => tryEnter(near)}>
              {near.open ? "Enter" : "Locked"}
            </button>
          </>
        ) : (
          <>
            Walk with <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> / arrow keys, or <b>click a door</b>.
          </>
        )}
      </div>
    </div>
  );
}

function Corridor() {
  return (
    <group>
      {/* floor + ceiling */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -5.5]} receiveShadow>
        <planeGeometry args={[6, 19]} />
        <meshStandardMaterial color="#120a1f" roughness={0.6} metalness={0.2} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 3.2, -5.5]}>
        <planeGeometry args={[6, 19]} />
        <meshStandardMaterial color="#0b0614" />
      </mesh>
      {/* walls */}
      {[-3, 3].map((x) => (
        <mesh key={x} position={[x, 1.6, -5.5]} rotation={[0, x < 0 ? Math.PI / 2 : -Math.PI / 2, 0]} receiveShadow>
          <planeGeometry args={[19, 3.2]} />
          <meshStandardMaterial color="#2c1c4a" />
        </mesh>
      ))}
      <mesh position={[0, 1.6, -14]}>
        <planeGeometry args={[6, 3.2]} />
        <meshStandardMaterial color="#2c1c4a" />
      </mesh>
      {/* purple neon strips + ceiling lights */}
      {[-2.95, 2.95].map((x) => (
        <Box key={x} size={[0.04, 0.04, 19]} position={[x, 0.05, -5.5]} color="#a855f7" emissive="#a855f7" />
      ))}
      <Box size={[0.08, 0.03, 17]} position={[0, 3.15, -5.5]} color="#c084fc" emissive="#c084fc" />
      {[0, -5, -10].map((z) => (
        <pointLight key={z} position={[0, 2.8, z]} color="#c084fc" intensity={5} distance={9} />
      ))}
    </group>
  );
}

function Door({ door, avatar, highlighted, onClick }: { door: DoorDef; avatar: AvatarId; highlighted: boolean; onClick: () => void }) {
  return (
    <group position={door.pos} rotation={[0, door.facing, 0]} onClick={(e) => (e.stopPropagation(), onClick())}>
      <Box size={[1.5, 2.6, 0.1]} position={[0, 0.05, 0]} color="#2a1745" />
      <Box size={[1.25, 2.35, 0.12]} position={[0, -0.02, 0.02]} color={door.open ? door.color : "#3f3f46"} emissive={highlighted ? door.color : undefined} />
      {door.id === 1 && (
        <>
          {/* WANTED poster taped to the door + the heist manga panel on the wall beside it */}
          <MangaPoster avatar={avatar} kind="wanted" width={0.9} position={[0, 0.2, 0.09]} />
          <MangaPoster avatar={avatar} kind="heist" width={1.45} position={[-1.65, 0.3, 0.0]} />
          <pointLight position={[-0.8, 0.9, 1.2]} color="#f5d0fe" intensity={4} distance={4} />
        </>
      )}
      <Box size={[0.1, 0.1, 0.1]} position={[0.45, -0.1, 0.12]} color="#facc15" />
      <Box size={[1.6, 0.06, 0.06]} position={[0, 1.38, 0.08]} color={door.color} emissive={door.color} />
      <pointLight position={[0, 1.4, 0.8]} color={door.color} intensity={highlighted ? 6 : 2.5} distance={4} />
    </group>
  );
}

function DoorLabel({ door }: { door: DoorDef }) {
  // World-space label just above the door frame, nudged into the corridor.
  const [x, , z] = door.pos;
  const pos: [number, number, number] = [x * 0.72, 2.85, door.facing === 0 ? z + 0.3 : z];
  return (
    <Label3D
      position={pos}
      title={`${door.open ? "" : "🔒 "}Door ${door.id}: ${door.title}`}
      subtitle={door.game}
      accent={door.open ? "#c084fc" : "#a1a1aa"}
      width={2.2}
      dim={!door.open}
      onTop
    />
  );
}

function Player({
  avatar,
  target,
  onNear,
}: {
  avatar: AvatarId;
  target: React.MutableRefObject<[number, number] | null>;
  onNear: (d: DoorDef | null) => void;
}) {
  const ref = useRef<Group>(null);
  const keys = useRef(new Set<string>());
  const nearId = useRef<number | null>(null);
  const [walking, setWalking] = useState(false);
  const { camera } = useThree();
  const camTarget = useRef(new Vector3());

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      keys.current.add(e.key.toLowerCase());
      if (e.key.startsWith("Arrow")) e.preventDefault();
    };
    const up = (e: KeyboardEvent) => keys.current.delete(e.key.toLowerCase());
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  useFrame((_, dt) => {
    const p = ref.current;
    if (!p) return;
    const k = keys.current;
    let dx = (k.has("d") || k.has("arrowright") ? 1 : 0) - (k.has("a") || k.has("arrowleft") ? 1 : 0);
    let dz = (k.has("s") || k.has("arrowdown") ? 1 : 0) - (k.has("w") || k.has("arrowup") ? 1 : 0);
    if (dx || dz) target.current = null;
    else if (target.current) {
      const [tx, tz] = target.current;
      dx = tx - p.position.x;
      dz = tz - p.position.z;
      if (Math.hypot(dx, dz) < 0.08) {
        target.current = null;
        dx = dz = 0;
      }
    }
    const len = Math.hypot(dx, dz);
    const moving = len > 0;
    if (moving) {
      p.position.x = Math.max(-HALF_W, Math.min(HALF_W, p.position.x + (dx / len) * SPEED * dt));
      p.position.z = Math.max(Z_MIN, Math.min(Z_MAX, p.position.z + (dz / len) * SPEED * dt));
      p.rotation.y = Math.atan2(dx, dz);
    }
    if (moving !== walking) setWalking(moving);

    // nearest door within reach
    let best: DoorDef | null = null;
    for (const d of DOORS) if (Math.hypot(p.position.x - d.stand[0], p.position.z - d.stand[1]) < 1.1) best = d;
    if ((best?.id ?? null) !== nearId.current) {
      nearId.current = best?.id ?? null;
      onNear(best);
    }

    // third-person camera follow
    camTarget.current.set(p.position.x * 0.6, 2.7, p.position.z + 4.6);
    camera.position.lerp(camTarget.current, 1 - Math.pow(0.002, dt));
    camera.lookAt(p.position.x * 0.8, 1.1, p.position.z - 2);
  });

  return (
    <group ref={ref} position={[0, 0, 1.5]} rotation={[0, Math.PI, 0]}>
      <AnimalSamurai avatar={avatar} walking={walking} />
    </group>
  );
}
