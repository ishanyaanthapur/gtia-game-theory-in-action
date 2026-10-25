// Manga-style posters for Door 1, drawn in code on a canvas (speed lines, halftone dots, chibi characters,
// Japanese SFX). They use the player's avatar colors, so the poster always shows *you* + Tung Tung Tung Sahur.
import { useEffect, useMemo } from "react";
import { CanvasTexture, SRGBColorSpace } from "three";
import type { ThreeElements } from "@react-three/fiber";
import { AVATARS, type AvatarStyle } from "../characters/avatars";
import type { AvatarId } from "../types";

type G = CanvasRenderingContext2D;
const INK = "#120a1a";
const WOOD = "#c08a53";
const WOOD_DARK = "#7a4f26";

// ---------- shared drawing helpers ----------

function halftone(g: G, w: number, h: number, color: string, gap = 14, r = 2.2) {
  g.fillStyle = color;
  for (let y = 0; y < h; y += gap)
    for (let x = (y / gap) % 2 ? gap / 2 : 0; x < w; x += gap) {
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
    }
}

function speedLines(g: G, cx: number, cy: number, n: number, inner: number, outer: number, color: string) {
  g.fillStyle = color;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + (i % 3) * 0.02;
    const spread = 0.012 + (i % 4) * 0.006;
    g.beginPath();
    g.moveTo(cx + Math.cos(a) * outer, cy + Math.sin(a) * outer);
    g.lineTo(cx + Math.cos(a - spread) * inner, cy + Math.sin(a - spread) * inner);
    g.lineTo(cx + Math.cos(a + spread) * inner, cy + Math.sin(a + spread) * inner);
    g.closePath();
    g.fill();
  }
}

function sfx(g: G, text: string, x: number, y: number, size: number, fill: string, rot = -0.12) {
  g.save();
  g.translate(x, y);
  g.rotate(rot);
  g.font = `900 ${size}px "Hiragino Sans", "Yu Gothic", "Noto Sans JP", sans-serif`;
  g.lineJoin = "round";
  g.lineWidth = size * 0.16;
  g.strokeStyle = INK;
  g.strokeText(text, 0, 0);
  g.fillStyle = fill;
  g.fillText(text, 0, 0);
  g.restore();
}

/** Big anime eye: white, large colored iris, dark pupil, two shine dots. */
function animeEye(g: G, x: number, y: number, r: number, iris: string, scared = false) {
  g.fillStyle = "#fff";
  g.strokeStyle = INK;
  g.lineWidth = r * 0.18;
  g.beginPath();
  g.ellipse(x, y, r * 0.8, r, 0, 0, Math.PI * 2);
  g.fill();
  g.stroke();
  const ir = scared ? r * 0.28 : r * 0.62;
  g.fillStyle = iris;
  g.beginPath();
  g.ellipse(x, y + r * 0.12, ir * 0.85, ir, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = INK;
  g.beginPath();
  g.arc(x, y + r * 0.15, ir * 0.5, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#fff";
  g.beginPath();
  g.arc(x - ir * 0.35, y - ir * 0.3, ir * 0.32, 0, Math.PI * 2);
  g.arc(x + ir * 0.3, y + ir * 0.35, ir * 0.14, 0, Math.PI * 2);
  g.fill();
}

/** Chibi samurai version of the player's avatar (ears, fur, armor colors come from the avatar). */
function chibi(g: G, x: number, y: number, s: number, a: AvatarStyle, lean = 0) {
  g.save();
  g.translate(x, y);
  g.rotate(lean);
  g.lineWidth = s * 0.04;
  g.strokeStyle = INK;
  // running legs
  g.fillStyle = a.limbs;
  g.beginPath();
  g.ellipse(-s * 0.32, s * 1.32, s * 0.16, s * 0.1, -0.4, 0, Math.PI * 2);
  g.ellipse(s * 0.34, s * 1.22, s * 0.16, s * 0.1, 0.5, 0, Math.PI * 2);
  g.fill();
  g.stroke();
  // hakama + armor body
  g.fillStyle = a.armor;
  g.beginPath();
  g.moveTo(-s * 0.42, s * 0.45);
  g.lineTo(s * 0.42, s * 0.45);
  g.lineTo(s * 0.55, s * 1.2);
  g.lineTo(-s * 0.55, s * 1.2);
  g.closePath();
  g.fill();
  g.stroke();
  g.fillStyle = a.trim;
  g.fillRect(-s * 0.45, s * 0.72, s * 0.9, s * 0.08);
  // katana on the back
  g.strokeStyle = "#d1d5db";
  g.lineWidth = s * 0.06;
  g.beginPath();
  g.moveTo(-s * 0.55, s * 0.3);
  g.lineTo(s * 0.7, s * 1.0);
  g.stroke();
  g.strokeStyle = INK;
  g.lineWidth = s * 0.04;
  // ears
  g.fillStyle = a.ears === "panda" ? INK : a.earColor ?? a.fur;
  if (a.ears === "cat") {
    for (const side of [-1, 1]) {
      g.beginPath();
      g.moveTo(side * s * 0.2, -s * 0.5);
      g.lineTo(side * s * 0.48, -s * 0.95);
      g.lineTo(side * s * 0.55, -s * 0.35);
      g.closePath();
      g.fill();
      g.stroke();
    }
  } else if (a.ears === "floppy") {
    for (const side of [-1, 1]) {
      g.beginPath();
      g.ellipse(side * s * 0.55, -s * 0.15, s * 0.16, s * 0.34, side * 0.35, 0, Math.PI * 2);
      g.fill();
      g.stroke();
    }
  } else {
    for (const side of [-1, 1]) {
      g.beginPath();
      g.arc(side * s * 0.42, -s * 0.62, s * 0.16, 0, Math.PI * 2);
      g.fill();
    }
  }
  // head
  g.fillStyle = a.fur;
  g.beginPath();
  g.arc(0, -s * 0.12, s * 0.55, 0, Math.PI * 2);
  g.fill();
  g.stroke();
  if (a.ears === "panda") {
    g.fillStyle = INK;
    for (const side of [-1, 1]) {
      g.beginPath();
      g.ellipse(side * s * 0.2, -s * 0.12, s * 0.15, s * 0.2, side * -0.5, 0, Math.PI * 2);
      g.fill();
    }
  }
  if (a.stripes) {
    g.strokeStyle = a.stripes;
    g.lineWidth = s * 0.05;
    for (const dx of [-0.12, 0, 0.12]) {
      g.beginPath();
      g.moveTo(dx * s, -s * 0.62);
      g.lineTo(dx * s, -s * 0.45);
      g.stroke();
    }
    g.strokeStyle = INK;
    g.lineWidth = s * 0.04;
  }
  // headband with flying tails
  g.fillStyle = a.headband;
  g.fillRect(-s * 0.55, -s * 0.42, s * 1.1, s * 0.11);
  g.beginPath();
  g.moveTo(-s * 0.5, -s * 0.38);
  g.quadraticCurveTo(-s * 0.95, -s * 0.5, -s * 1.15, -s * 0.25);
  g.lineTo(-s * 1.05, -s * 0.18);
  g.quadraticCurveTo(-s * 0.85, -s * 0.38, -s * 0.5, -s * 0.3);
  g.fill();
  // muzzle, eyes, mouth
  g.fillStyle = a.muzzle;
  g.beginPath();
  g.ellipse(0, s * 0.12, s * 0.25, s * 0.17, 0, 0, Math.PI * 2);
  g.fill();
  animeEye(g, -s * 0.2, -s * 0.12, s * 0.15, a.armor);
  animeEye(g, s * 0.2, -s * 0.12, s * 0.15, a.armor);
  g.fillStyle = a.id === "yoshi" ? "#f472b6" : INK;
  g.beginPath();
  g.ellipse(0, s * 0.05, s * 0.06, s * 0.04, 0, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = INK;
  g.beginPath();
  g.arc(0, s * 0.12, s * 0.09, 0.15 * Math.PI, 0.85 * Math.PI); // sly grin
  g.stroke();
  // blush
  g.fillStyle = "rgba(244, 114, 182, 0.55)";
  g.beginPath();
  g.ellipse(-s * 0.36, s * 0.05, s * 0.08, s * 0.04, 0, 0, Math.PI * 2);
  g.ellipse(s * 0.36, s * 0.05, s * 0.08, s * 0.04, 0, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

/** Tung Tung Tung Sahur: tall wooden log, huge eyes, bat raised. */
function tung(g: G, x: number, y: number, s: number, lean = 0, scared = false) {
  g.save();
  g.translate(x, y);
  g.rotate(lean);
  g.lineWidth = s * 0.04;
  g.strokeStyle = INK;
  // stick legs
  g.beginPath();
  g.moveTo(-s * 0.15, s * 1.2);
  g.lineTo(-s * 0.3, s * 1.6);
  g.moveTo(s * 0.15, s * 1.2);
  g.lineTo(s * 0.35, s * 1.55);
  g.stroke();
  // log body
  g.fillStyle = WOOD;
  g.beginPath();
  g.roundRect(-s * 0.36, -s * 1.0, s * 0.72, s * 2.25, s * 0.3);
  g.fill();
  g.stroke();
  g.strokeStyle = WOOD_DARK;
  for (const yy of [0.6, 0.85]) {
    g.beginPath();
    g.moveTo(-s * 0.36, yy * s);
    g.quadraticCurveTo(0, (yy + 0.08) * s, s * 0.36, yy * s);
    g.stroke();
  }
  g.strokeStyle = INK;
  // bat arm raised
  g.beginPath();
  g.moveTo(s * 0.34, -s * 0.05);
  g.lineTo(s * 0.7, -s * 0.5);
  g.stroke();
  g.fillStyle = "#e3c38f";
  g.save();
  g.translate(s * 0.72, -s * 0.52);
  g.rotate(-0.6);
  g.beginPath();
  g.roundRect(-s * 0.05, -s * 0.85, s * 0.13, s * 0.9, s * 0.06);
  g.fill();
  g.stroke();
  g.restore();
  g.beginPath();
  g.moveTo(-s * 0.34, 0);
  g.lineTo(-s * 0.7, s * 0.3);
  g.stroke();
  // face
  animeEye(g, -s * 0.15, -s * 0.48, s * 0.16, "#3b2414", scared);
  animeEye(g, s * 0.17, -s * 0.48, s * 0.16, "#3b2414", scared);
  g.lineWidth = s * 0.05;
  g.beginPath();
  g.moveTo(-s * 0.28, -s * 0.72);
  g.lineTo(-s * 0.05, -s * 0.66);
  g.moveTo(s * 0.3, -s * 0.72);
  g.lineTo(s * 0.06, -s * 0.66);
  g.stroke();
  g.fillStyle = INK;
  g.beginPath();
  if (scared) g.ellipse(0, -s * 0.15, s * 0.08, s * 0.11, 0, 0, Math.PI * 2);
  else g.arc(0, -s * 0.22, s * 0.17, 0.1 * Math.PI, 0.9 * Math.PI);
  g.fill();
  g.restore();
}

function gpuCart(g: G, x: number, y: number, s: number) {
  g.save();
  g.translate(x, y);
  g.lineWidth = s * 0.03;
  g.strokeStyle = INK;
  // GPUs stacked + spilling
  const gpus: [number, number, number][] = [[-0.55, -0.55, -0.1], [-0.1, -0.62, 0.08], [0.32, -0.5, -0.05], [-0.3, -0.85, 0.15], [0.12, -0.95, -0.2]];
  for (const [gx, gy, r] of gpus) {
    g.save();
    g.translate(gx * s, gy * s);
    g.rotate(r);
    g.fillStyle = "#16a34a";
    g.fillRect(-s * 0.25, -s * 0.11, s * 0.5, s * 0.22);
    g.strokeRect(-s * 0.25, -s * 0.11, s * 0.5, s * 0.22);
    g.fillStyle = "#fbbf24";
    g.fillRect(-s * 0.22, s * 0.06, s * 0.44, s * 0.03);
    g.fillStyle = INK;
    g.fillRect(-s * 0.08, -s * 0.07, s * 0.16, s * 0.1);
    g.restore();
  }
  // cart
  g.fillStyle = "#64748b";
  g.beginPath();
  g.moveTo(-s * 0.85, -s * 0.4);
  g.lineTo(s * 0.85, -s * 0.4);
  g.lineTo(s * 0.7, s * 0.3);
  g.lineTo(-s * 0.7, s * 0.3);
  g.closePath();
  g.fill();
  g.stroke();
  g.fillStyle = "#f8fafc";
  g.save();
  g.rotate(-0.04);
  g.fillRect(-s * 0.62, -s * 0.18, s * 1.24, s * 0.26);
  g.strokeRect(-s * 0.62, -s * 0.18, s * 1.24, s * 0.26);
  g.fillStyle = INK;
  g.font = `900 ${s * 0.115}px Inter, system-ui, sans-serif`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText("DEFINITELY NOT GPUs", 0, -s * 0.05, s * 1.15);
  g.restore();
  for (const wx of [-0.5, 0.5]) {
    g.fillStyle = INK;
    g.beginPath();
    g.arc(wx * s, s * 0.4, s * 0.12, 0, Math.PI * 2);
    g.fill();
  }
  g.restore();
}

function vault(g: G, x: number, y: number, r: number) {
  g.save();
  g.translate(x, y);
  g.lineWidth = r * 0.06;
  g.strokeStyle = INK;
  g.fillStyle = "#94a3b8";
  g.beginPath();
  g.arc(0, 0, r, 0, Math.PI * 2);
  g.fill();
  g.stroke();
  g.fillStyle = "#cbd5e1";
  g.beginPath();
  g.arc(0, 0, r * 0.72, 0, Math.PI * 2);
  g.fill();
  g.stroke();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(Math.cos(a) * r * 0.5, Math.sin(a) * r * 0.5);
    g.stroke();
  }
  g.fillStyle = INK;
  g.beginPath();
  g.arc(0, 0, r * 0.12, 0, Math.PI * 2);
  g.fill();
  g.font = `900 ${r * 0.22}px Inter, system-ui, sans-serif`;
  g.textAlign = "center";
  g.fillText("GPU VAULT", 0, r * 1.32);
  g.restore();
}

function panelFrame(g: G, w: number, h: number) {
  g.lineWidth = 14;
  g.strokeStyle = INK;
  g.strokeRect(7, 7, w - 14, h - 14);
  g.lineWidth = 4;
  g.strokeStyle = "#fff";
  g.strokeRect(20, 20, w - 40, h - 40);
}

// ---------- the two posters ----------

function drawHeist(g: G, w: number, h: number, a: AvatarStyle) {
  const bg = g.createRadialGradient(w * 0.5, h * 0.55, 40, w * 0.5, h * 0.55, h * 0.75);
  bg.addColorStop(0, "#f5d0fe");
  bg.addColorStop(0.45, "#a855f7");
  bg.addColorStop(1, "#2e1065");
  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);
  halftone(g, w, h, "rgba(46, 16, 101, 0.28)", 16, 2.6);
  speedLines(g, w * 0.5, h * 0.58, 90, h * 0.22, h * 1.2, "rgba(255,255,255,0.55)");
  vault(g, w * 0.8, h * 0.3, 92);
  gpuCart(g, w * 0.52, h * 0.74, 210);
  tung(g, w * 0.86, h * 0.64, 112, 0.12);
  chibi(g, w * 0.17, h * 0.58, 135, a, -0.14);
  sfx(g, "ゴゴゴゴ", w * 0.05, h * 0.35, 78, "#c084fc", -0.22);
  sfx(g, "ドン!", w * 0.62, h * 0.95, 70, "#fde047", -0.08);
  // title band
  g.fillStyle = INK;
  g.fillRect(0, 0, w, 150);
  g.fillStyle = "#fde047";
  g.font = "italic 900 74px Inter, system-ui, sans-serif";
  g.textAlign = "center";
  g.fillText("THE GREAT", w / 2, 70);
  g.fillStyle = "#fff";
  g.fillText("GPU HEIST", w / 2, 138);
  g.font = "700 30px \"Hiragino Sans\", \"Noto Sans JP\", sans-serif";
  g.fillStyle = "#c084fc";
  g.textAlign = "left";
  g.fillText("第1話", 34, 52);
  // caption box
  g.fillStyle = "#fff";
  g.fillRect(w * 0.06, h * 0.82, w * 0.5, 92);
  g.lineWidth = 6;
  g.strokeStyle = INK;
  g.strokeRect(w * 0.06, h * 0.82, w * 0.5, 92);
  g.fillStyle = INK;
  g.font = "800 30px Inter, system-ui, sans-serif";
  g.fillText(`${a.name} & Tung Tung`, w * 0.08, h * 0.82 + 40);
  g.fillText("Tung Sahur strike!", w * 0.08, h * 0.82 + 76);
  panelFrame(g, w, h);
}

function drawWanted(g: G, w: number, h: number, a: AvatarStyle) {
  g.fillStyle = "#f3e2bf";
  g.fillRect(0, 0, w, h);
  halftone(g, w, h, "rgba(120, 80, 30, 0.18)", 18, 2.4);
  g.fillStyle = "#7f1d1d";
  g.font = "900 140px Inter, system-ui, sans-serif";
  g.textAlign = "center";
  g.fillText("WANTED", w / 2, 160);
  g.font = "900 44px \"Hiragino Sans\", \"Noto Sans JP\", sans-serif";
  g.fillStyle = INK;
  g.fillText("指名手配", w / 2, 218);
  // two mugshot frames
  const boxes: [number, string][] = [[w * 0.27, a.name], [w * 0.73, "Tung Tung Tung Sahur"]];
  for (const [cx] of boxes) {
    g.fillStyle = "#fff7e6";
    g.fillRect(cx - 170, 250, 340, 380);
    g.lineWidth = 8;
    g.strokeStyle = INK;
    g.strokeRect(cx - 170, 250, 340, 380);
    speedLines(g, cx, 440, 40, 120, 260, "rgba(127, 29, 29, 0.18)");
  }
  chibi(g, w * 0.27, 420, 125, a);
  tung(g, w * 0.73, 470, 110, 0, true);
  g.font = "800 30px Inter, system-ui, sans-serif";
  g.fillStyle = INK;
  boxes.forEach(([cx, name]) => {
    g.font = `800 ${name.length > 12 ? 24 : 32}px Inter, system-ui, sans-serif`;
    g.fillText(name, cx, 672);
  });
  g.font = "700 34px Inter, system-ui, sans-serif";
  g.fillText("For stealing 10,000 H100s", w / 2, 750);
  g.fillText("from the GPU vault", w / 2, 792);
  g.fillStyle = "#7f1d1d";
  g.font = "900 46px Inter, system-ui, sans-serif";
  g.fillText("REWARD: ONE CONFESSION", w / 2, 875);
  sfx(g, "ドキッ", w * 0.62, h * 0.955, 48, "#f472b6", -0.1);
  panelFrame(g, w, h);
}

type Props = ThreeElements["mesh"] & { avatar: AvatarId; kind: "heist" | "wanted"; width?: number };

export function MangaPoster({ avatar, kind, width = 1.3, ...mesh }: Props) {
  const W = 768;
  const H = 1024;
  const texture = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    const g = c.getContext("2d")!;
    (kind === "heist" ? drawHeist : drawWanted)(g, W, H, AVATARS[avatar]);
    const t = new CanvasTexture(c);
    t.colorSpace = SRGBColorSpace;
    t.anisotropy = 8;
    return t;
  }, [avatar, kind]);
  useEffect(() => () => texture.dispose(), [texture]);

  return (
    <mesh {...mesh}>
      <planeGeometry args={[width, (width * H) / W]} />
      <meshBasicMaterial map={texture} toneMapped={false} />
    </mesh>
  );
}

/** Flat PNG of a poster (handy for report screenshots): renderPosterPNG("kimchi", "heist"). */
export function renderPosterPNG(avatar: AvatarId, kind: "heist" | "wanted"): string {
  const c = document.createElement("canvas");
  c.width = 768;
  c.height = 1024;
  (kind === "heist" ? drawHeist : drawWanted)(c.getContext("2d")!, 768, 1024, AVATARS[avatar]);
  return c.toDataURL("image/png");
}
