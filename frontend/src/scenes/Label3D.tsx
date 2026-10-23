// A floating text label drawn onto a canvas texture (no extra React roots, unlike drei <Html>).
import { useEffect, useMemo } from "react";
import { CanvasTexture, SRGBColorSpace } from "three";

interface Props {
  position: [number, number, number];
  title: string;
  subtitle?: string;
  accent?: string;
  width?: number; // world units
  dim?: boolean;
}

export function Label3D({ position, title, subtitle, accent = "#c084fc", width = 1.8, dim = false }: Props) {
  const { texture, aspect } = useMemo(() => {
    const W = 640;
    const H = subtitle ? 190 : 120;
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    const g = c.getContext("2d")!;
    g.fillStyle = "rgba(20, 12, 36, 0.9)";
    g.strokeStyle = accent;
    g.lineWidth = 5;
    g.beginPath();
    g.roundRect(4, 4, W - 8, H - 8, 28);
    g.fill();
    g.stroke();
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillStyle = accent;
    g.font = "700 54px Inter, system-ui, sans-serif";
    g.fillText(title, W / 2, subtitle ? 68 : H / 2, W - 40);
    if (subtitle) {
      g.fillStyle = "#ede9fe";
      g.font = "500 42px Inter, system-ui, sans-serif";
      g.fillText(subtitle, W / 2, 132, W - 40);
    }
    const t = new CanvasTexture(c);
    t.colorSpace = SRGBColorSpace;
    t.anisotropy = 4;
    return { texture: t, aspect: H / W };
  }, [title, subtitle, accent]);

  useEffect(() => () => texture.dispose(), [texture]);

  return (
    <sprite position={position} scale={[width, width * aspect, 1]}>
      <spriteMaterial map={texture} transparent opacity={dim ? 0.65 : 1} depthWrite={false} toneMapped={false} />
    </sprite>
  );
}
