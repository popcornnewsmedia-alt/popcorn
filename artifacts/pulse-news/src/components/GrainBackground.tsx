import { useEffect, useRef } from "react";

export function GrainBackground({ variant = "light" }: { variant?: "light" | "dark" | "cream" | "pale" | "paper" | "white" }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const W = canvas.parentElement?.clientWidth || window.innerWidth || 390;
    const H = canvas.parentElement?.clientHeight || window.innerHeight || 844;
    if (W === 0 || H === 0) return;
    canvas.width = W;
    canvas.height = H;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    ctx.fillStyle = variant === "dark" ? '#b32b21' : variant === "cream" ? '#fff1cd' : variant === "pale" ? '#fbf8f2' : variant === "paper" ? '#fdf7e5' : variant === "white" ? '#ffffff' : '#053980';
    ctx.fillRect(0, 0, W, H);

    const DS = 4;
    const DW = Math.ceil(W / DS), DH = Math.ceil(H / DS);
    const dmap = new Float32Array(DW * DH);

    const blobs: Array<{ x: number; y: number; s: number; w: number }> = [];
    for (let i = 0; i < 7; i++)
      blobs.push({ x: Math.random()*DW, y: Math.random()*DH, s: (0.14+Math.random()*0.22)*DW, w: 0.5+Math.random()*0.9 });
    for (let i = 0; i < 20; i++)
      blobs.push({ x: Math.random()*DW, y: Math.random()*DH, s: (0.04+Math.random()*0.10)*DW, w: 0.4+Math.random()*0.8 });
    for (let i = 0; i < 40; i++)
      blobs.push({ x: Math.random()*DW, y: Math.random()*DH, s: (0.01+Math.random()*0.03)*DW, w: 0.2+Math.random()*0.5 });

    for (let by = 0; by < DH; by++) {
      for (let bx = 0; bx < DW; bx++) {
        let sum = 0;
        for (const b of blobs) {
          const dx = bx - b.x, dy = by - b.y;
          sum += b.w * Math.exp(-(dx*dx + dy*dy) / (2 * b.s * b.s));
        }
        dmap[by * DW + bx] = sum;
      }
    }

    const sorted = Array.from(dmap).sort((a, b) => a - b);
    const p90 = sorted[Math.floor(sorted.length * 0.90)] || 1;

    const imgData = ctx.getImageData(0, 0, W, H);
    const data = imgData.data;

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const idx = (y * W + x) * 4;
        const fx = x / DS, fy = y / DS;
        const x0 = Math.min(Math.floor(fx), DW - 2);
        const y0 = Math.min(Math.floor(fy), DH - 2);
        const tx = fx - x0, ty = fy - y0;
        const d = (dmap[y0*DW+x0]*(1-tx) + dmap[y0*DW+x0+1]*tx)*(1-ty)
                + (dmap[(y0+1)*DW+x0]*(1-tx) + dmap[(y0+1)*DW+x0+1]*tx)*ty;
        const density = Math.min(1, d / p90);
        if (variant !== "pale" && variant !== "paper" && variant !== "white" && density < 0.06) continue;

        // pale/paper/white use flat intensity so blobs don't create visible bright/dark patches
        const effective = variant === "pale" ? 0.45 : variant === "paper" ? 0.40 : variant === "white" ? 0.32 : (0.1152 + density * 0.5248);
        const gi = effective * (13 + Math.random() * 9);
        const grain = Math.random() * gi - gi * 0.6;

        if (variant === "dark") {
          data[idx]   = Math.max(129, Math.min(229, 179 + Math.round(grain * 2.048 - 2.56)));
          data[idx+1] = Math.max(0,   Math.min(93,  43  + Math.round(grain * 1.472 - 1.28)));
          data[idx+2] = Math.max(0,   Math.min(83,  33  + Math.round(grain * 1.472 - 1.28)));
        } else if (variant === "cream") {
          // #fff1cd — R=255,G=241,B=205 — R dominant
          data[idx]   = Math.max(205, Math.min(255, 255 + Math.round(grain * 2.048 - 2.56)));
          data[idx+1] = Math.max(191, Math.min(255, 241 + Math.round(grain * 1.472 - 1.28)));
          data[idx+2] = Math.max(155, Math.min(255, 205 + Math.round(grain * 1.472 - 1.28)));
        } else if (variant === "pale") {
          // #fbf8f2 — R=251,G=248,B=242 — light cream, slightly warmer, stronger grain
          data[idx]   = Math.max(201, Math.min(255, 251 + Math.round(grain * 2.048 - 2.56)));
          data[idx+1] = Math.max(198, Math.min(255, 248 + Math.round(grain * 1.928 - 2.010)));
          data[idx+2] = Math.max(192, Math.min(255, 242 + Math.round(grain * 1.928 - 2.010)));
        } else if (variant === "white") {
          // #ffffff — pure white, grain only darkens, very subtle
          data[idx]   = Math.max(230, Math.min(255, 255 + Math.round(grain * 1.472 - 1.28)));
          data[idx+1] = Math.max(230, Math.min(255, 255 + Math.round(grain * 1.472 - 1.28)));
          data[idx+2] = Math.max(230, Math.min(255, 255 + Math.round(grain * 1.472 - 1.28)));
        } else if (variant === "paper") {
          // #fdf7e5 — R=253,G=247,B=229 — article reader, 15% less cream than pale, uniform grain
          data[idx]   = Math.max(203, Math.min(255, 253 + Math.round(grain * 2.683 - 4.022)));
          data[idx+1] = Math.max(197, Math.min(255, 247 + Math.round(grain * 1.928 - 2.010)));
          data[idx+2] = Math.max(179, Math.min(255, 229 + Math.round(grain * 1.928 - 2.010)));
        } else {
          // #053980 — R=5,G=57,B=128 — B dominant
          data[idx]   = Math.max(0,  Math.min(55,   5 + Math.round(grain * 1.472 - 1.28)));
          data[idx+1] = Math.max(7,  Math.min(107, 57 + Math.round(grain * 1.472 - 1.28)));
          data[idx+2] = Math.max(78, Math.min(178, 128 + Math.round(grain * 2.048 - 2.56)));
        }
      }
    }
    ctx.putImageData(imgData, 0, 0);
  }, [variant]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
    />
  );
}
