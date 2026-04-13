import { Application, extend } from "@pixi/react";
import { Container, Graphics } from "pixi.js";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSquadStore } from "@/store/useSquadStore";
import { AgentDesk, CELL_W, CELL_H, GRID_OFFSET_X, GRID_OFFSET_Y } from "./AgentDesk";
import { HandoffEnvelope } from "./HandoffEnvelope";
import { sortAgentsByDesk, findAgent } from "@/lib/normalizeState";
import { drawFloor } from "./drawRoom";
import { drawBookshelf, drawPlant, drawClock, drawWhiteboard, drawCoffeeMachine, drawFilingCabinet } from "./drawFurniture";
import { TILE, COLORS } from "./palette";
import type { Graphics as PixiGraphics } from "pixi.js";

extend({ Container, Graphics });

export function OfficeScene() {
  const state = useSquadStore((s) =>
    s.selectedSquad ? s.activeStates.get(s.selectedSquad) : undefined
  );
  const squadInfo = useSquadStore((s) =>
    s.selectedSquad ? s.squads.get(s.selectedSquad) : undefined
  );

  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ w: 800, h: 500 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver((entries) => {
      const r = entries[0].contentRect;
      setContainerSize({ w: Math.floor(r.width), h: Math.floor(r.height) });
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const agents = useMemo(
    () => (state?.agents ? sortAgentsByDesk(state.agents) : []),
    [state]
  );

  const maxCol = agents.length > 0 ? Math.max(...agents.map((a) => a.desk.col)) : 1;
  const maxRow = agents.length > 0 ? Math.max(...agents.map((a) => a.desk.row)) : 1;

  // Content dimensions (agent grid)
  const wallTop = TILE * 2;
  const marginX = Math.round(TILE * 1.5);
  const marginY = TILE * 1;
  const contentW = marginX * 2 + maxCol * CELL_W + GRID_OFFSET_X;
  const contentH = marginY * 2 + maxRow * CELL_H + GRID_OFFSET_Y;

  // Scale to fill available space, keeping pixel-art crispness
  const scaleX = containerSize.w / contentW;
  const scaleY = containerSize.h / contentH;
  const scale = Math.min(scaleX, scaleY, 2.5); // cap at 2.5x for crispness

  const stageW = containerSize.w;
  const stageH = containerSize.h;

  // Derived floor coords (before scaling — PixiJS applies scale via container)
  const floorW = marginX * 2 + maxCol * CELL_W;
  const floorH = marginY * 2 + maxRow * CELL_H;
  const floorX = GRID_OFFSET_X - marginX;
  const floorY = GRID_OFFSET_Y - marginY;

  const drawBackground = useCallback(
    (g: PixiGraphics) => {
      g.clear();
      g.rect(0, 0, contentW, contentH);
      g.fill({ color: 0x101018 });

      drawFloor(g, floorW, floorH, floorX, floorY);

      g.rect(floorX - 1, 0, floorW + 2, wallTop);
      g.fill({ color: COLORS.wallFace });
      g.rect(floorX - 1, wallTop - 3, floorW + 2, 3);
      g.fill({ color: COLORS.wallShadow });
      g.rect(floorX, wallTop, floorW, 3);
      g.fill({ color: 0x000000, alpha: 0.06 });

      g.rect(floorX - 1, wallTop, 1, floorH);
      g.fill({ color: COLORS.wallShadow });
      g.rect(floorX + floorW, wallTop, 1, floorH);
      g.fill({ color: COLORS.wallShadow });
      g.rect(floorX - 1, wallTop + floorH, floorW + 2, 1);
      g.fill({ color: COLORS.wallShadow });

      const wallItemY = 4;
      drawBookshelf(g, floorX + 10, wallItemY);
      if (floorW > 300) drawBookshelf(g, floorX + floorW - 74, wallItemY);
      drawWhiteboard(g, floorX + floorW / 2 - 24, wallItemY);
      drawClock(g, floorX + floorW / 2 + 28, wallItemY + 6);

      drawPlant(g, floorX + 4, floorY + 8);
      drawPlant(g, floorX + floorW - 36, floorY + 8);
      drawPlant(g, floorX + 4, floorY + floorH - 36);
      drawFilingCabinet(g, floorX + floorW - 36, floorY + floorH - 52);
      if (floorH > 200) drawCoffeeMachine(g, floorX + floorW - 36, floorY + floorH / 2 - 16);
    },
    [contentW, contentH, floorW, floorH, floorX, floorY, wallTop]
  );

  if (!state) {
    return (
      <div
        ref={containerRef}
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          gap: 12,
          background: "#101018",
          color: "var(--text-secondary)",
        }}
      >
        {squadInfo ? (
          <>
            <span style={{ fontSize: 56, filter: "grayscale(0.3)" }}>{squadInfo.icon}</span>
            <span style={{ fontSize: 18, color: "var(--text-primary)", fontWeight: 700 }}>{squadInfo.name}</span>
            <span style={{ fontSize: 12, maxWidth: 320, textAlign: "center", lineHeight: 1.6 }}>
              {squadInfo.description}
            </span>
            <span style={{ fontSize: 11, marginTop: 4, opacity: 0.5 }}>
              Squad inativo — use ▶ Ativar para iniciar
            </span>
          </>
        ) : (
          <>
            <span style={{ fontSize: 40 }}>🏢</span>
            <span style={{ fontSize: 14 }}>Selecione um squad para visualizar</span>
          </>
        )}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      style={{ flex: 1, width: "100%", height: "100%", overflow: "hidden", background: "#101018" }}
    >
      {stageW > 0 && stageH > 0 && (
        <Application width={stageW} height={stageH} backgroundColor={0x101018}>
          {/* Centered, scaled container */}
          <pixiContainer
            x={Math.max(0, (stageW - contentW * scale) / 2)}
            y={Math.max(0, (stageH - contentH * scale) / 2)}
            scale={scale}
          >
            <pixiGraphics draw={drawBackground} />
            {agents.map((agent, i) => (
              <AgentDesk key={agent.id} agent={agent} agentIndex={i} />
            ))}
            {state.handoff &&
              (() => {
                const from = findAgent(state, state.handoff!.from);
                const to = findAgent(state, state.handoff!.to);
                if (!from || !to) return null;
                return (
                  <HandoffEnvelope handoff={state.handoff!} fromAgent={from} toAgent={to} />
                );
              })()}
          </pixiContainer>
        </Application>
      )}
    </div>
  );
}
