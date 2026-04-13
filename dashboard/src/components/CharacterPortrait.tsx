/**
 * CharacterPortrait — renders a pixel-art persona face on a <canvas>.
 * Each agent gets a unique color variant (round-robin by index).
 * No emojis used.
 */
import { useEffect, useRef, useState } from "react";

// ─────────────────────────────────────────────
// Color variants per agent index
// ─────────────────────────────────────────────

export const CHAR_VARIANTS = [
  { hair: "#2a2018", skin: "#f5c5a3", shirt: "#3a6898" }, // azul
  { hair: "#6a4a2a", skin: "#d4a574", shirt: "#3a7a3a" }, // verde
  { hair: "#d4a840", skin: "#f5c5a3", shirt: "#983838" }, // vermelho
  { hair: "#b04020", skin: "#8b6340", shirt: "#c0b8ac" }, // branco
  { hair: "#2a2018", skin: "#d4a574", shirt: "#6a4890" }, // roxo
  { hair: "#6a4a2a", skin: "#f5c5a3", shirt: "#3a6898" }, // azul 2
];

export type CharVariant = typeof CHAR_VARIANTS[0];

// ─────────────────────────────────────────────
// Canvas drawing
// ─────────────────────────────────────────────

export function drawPortrait(
  ctx: CanvasRenderingContext2D,
  v: CharVariant,
  status: string,
  frame: number
) {
  ctx.clearRect(0, 0, 48, 48);
  ctx.imageSmoothingEnabled = true;

  const isWorking    = status === "working" || status === "delivering";
  const isDone       = status === "done";
  const isCheckpoint = status === "checkpoint";

  // Hair (back)
  ctx.fillStyle = v.hair;
  ctx.beginPath(); ctx.arc(24, 19, 14, 0, Math.PI * 2); ctx.fill();

  // Ears
  ctx.fillStyle = v.skin;
  ctx.beginPath(); ctx.ellipse(13.5, 22, 2.5, 3.5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(34.5, 22, 2.5, 3.5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "rgba(0,0,0,0.1)";
  ctx.beginPath(); ctx.ellipse(13.5, 22, 1.2, 2.2, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(34.5, 22, 1.2, 2.2, 0, 0, Math.PI * 2); ctx.fill();

  // Face
  ctx.fillStyle = v.skin;
  ctx.beginPath(); ctx.ellipse(24, 22, 10.5, 12, 0, 0, Math.PI * 2); ctx.fill();
  const g = ctx.createLinearGradient(14, 0, 34, 0);
  g.addColorStop(0,   "rgba(0,0,0,0.07)");
  g.addColorStop(0.4, "rgba(0,0,0,0)");
  g.addColorStop(1,   "rgba(255,255,255,0.03)");
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.ellipse(24, 22, 10.5, 12, 0, 0, Math.PI * 2); ctx.fill();

  // Eyebrows
  ctx.strokeStyle = v.hair;
  ctx.lineWidth = 1.8; ctx.lineCap = "round";
  const browY = isWorking ? 15.5 : 16.5;
  ctx.beginPath(); ctx.moveTo(17, browY + 1); ctx.quadraticCurveTo(20, browY - 1, 23, browY); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(25, browY); ctx.quadraticCurveTo(28, browY - 1, 31, browY + 1); ctx.stroke();

  // Eyes
  const eyeY = 21;
  const pupilBob = isWorking && frame === 1 ? 0.6 : 0;
  ctx.fillStyle = "white";
  ctx.beginPath(); ctx.ellipse(19.5, eyeY, 3.5, 2.5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(28.5, eyeY, 3.5, 2.5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.12)"; ctx.lineWidth = 0.5;
  ctx.beginPath(); ctx.ellipse(19.5, eyeY, 3.5, 2.5, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(28.5, eyeY, 3.5, 2.5, 0, 0, Math.PI * 2); ctx.stroke();
  const px = isWorking ? 0.5 : 0;
  ctx.fillStyle = "#1a1008";
  ctx.beginPath(); ctx.arc(19.5 + px, eyeY + pupilBob, 1.8, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(28.5 + px, eyeY + pupilBob, 1.8, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = v.shirt + "aa"; ctx.lineWidth = 0.8;
  ctx.beginPath(); ctx.arc(19.5 + px, eyeY + pupilBob, 2.4, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(28.5 + px, eyeY + pupilBob, 2.4, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,0.8)";
  ctx.beginPath(); ctx.arc(20.4, eyeY - 0.9, 0.7, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(29.4, eyeY - 0.9, 0.7, 0, Math.PI * 2); ctx.fill();

  // Nose
  ctx.strokeStyle = "rgba(0,0,0,0.12)"; ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(23, 25); ctx.lineTo(22, 27); ctx.lineTo(23.5, 27.5);
  ctx.moveTo(25, 27.5); ctx.lineTo(26, 27);
  ctx.stroke();

  // Mouth
  ctx.lineWidth = 1.6; ctx.lineCap = "round"; ctx.strokeStyle = "#7a4030";
  if (isDone) {
    ctx.beginPath(); ctx.arc(24, 28, 4, 0.15, Math.PI - 0.15); ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.9)"; ctx.fillRect(20.5, 28, 7, 2.5);
  } else if (isWorking) {
    ctx.beginPath(); ctx.moveTo(20, 29); ctx.quadraticCurveTo(24, 31, 28, 29); ctx.stroke();
  } else if (isCheckpoint) {
    ctx.beginPath(); ctx.moveTo(20, 30); ctx.quadraticCurveTo(24, 28.5, 28, 30); ctx.stroke();
  } else {
    ctx.beginPath(); ctx.moveTo(21, 29.5); ctx.lineTo(27, 29.5); ctx.stroke();
  }

  // Neck + shirt
  ctx.fillStyle = v.skin; ctx.fillRect(20, 34, 8, 4);
  ctx.fillStyle = v.shirt; ctx.fillRect(8, 37, 32, 11);
  const sg = ctx.createLinearGradient(8, 37, 8, 48);
  sg.addColorStop(0, "rgba(255,255,255,0.13)"); sg.addColorStop(1, "rgba(0,0,0,0.12)");
  ctx.fillStyle = sg; ctx.fillRect(8, 37, 32, 11);
  ctx.fillStyle = "rgba(255,255,255,0.88)";
  ctx.beginPath(); ctx.moveTo(19, 37); ctx.lineTo(24, 42); ctx.lineTo(29, 37); ctx.closePath(); ctx.fill();

  // Status badges
  if (isCheckpoint) {
    ctx.fillStyle = "#fbbf24ee";
    ctx.beginPath(); ctx.arc(39, 9, 7, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#1a1008"; ctx.font = "bold 10px sans-serif";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("?", 39, 10);
  } else if (isDone) {
    ctx.fillStyle = "#22c55ecc";
    ctx.beginPath(); ctx.arc(39, 9, 7, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "white"; ctx.lineWidth = 2; ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.beginPath(); ctx.moveTo(35, 9); ctx.lineTo(38, 12); ctx.lineTo(43, 5.5); ctx.stroke();
  }
}

// ─────────────────────────────────────────────
// React component
// ─────────────────────────────────────────────

export function CharacterPortrait({
  variantIndex,
  status = "idle",
  size = 44,
  circle = true,
}: {
  variantIndex: number;
  status?: string;
  size?: number;
  circle?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [frame, setFrame] = useState(0);
  const frameRef = useRef(0);

  useEffect(() => {
    const active = status === "working" || status === "delivering";
    if (!active) { setFrame(0); frameRef.current = 0; return; }
    const id = setInterval(() => {
      frameRef.current = (frameRef.current + 1) % 2;
      setFrame(frameRef.current);
    }, 420);
    return () => clearInterval(id);
  }, [status]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    drawPortrait(ctx, CHAR_VARIANTS[variantIndex % CHAR_VARIANTS.length], status, frame);
  }, [variantIndex, status, frame]);

  return (
    <canvas
      ref={canvasRef}
      width={48}
      height={48}
      style={{
        width: size,
        height: size,
        display: "block",
        borderRadius: circle ? "50%" : 2,
      }}
    />
  );
}
