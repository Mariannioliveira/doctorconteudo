import { useSquadStore } from "@/store/useSquadStore";
import { CharacterPortrait } from "@/components/CharacterPortrait";
import type { Agent } from "@/types/state";

const STATUS_COLORS: Record<string, string> = {
  working:    "#22c55e",
  delivering: "#22c55e",
  checkpoint: "#fbbf24",
  done:       "#06b6d4",
  idle:       "#2a3248",
};

// ─────────────────────────────────────────────
// AgentDeskCard
// ─────────────────────────────────────────────

function AgentDeskCard({
  agent,
  index,
  selected,
  onClick,
}: {
  agent: Agent;
  index: number;
  selected: boolean;
  onClick: () => void;
}) {
  const isActive     = agent.status === "working" || agent.status === "delivering";
  const isCheckpoint = agent.status === "checkpoint";
  const isDone       = agent.status === "done";
  const sc           = STATUS_COLORS[agent.status] ?? STATUS_COLORS.idle;

  return (
    <div
      onClick={onClick}
      title={`${agent.name} — ${statusLabel(agent.status)}`}
      style={{
        position:      "relative",
        display:       "flex",
        flexDirection: "column",
        alignItems:    "center",
        gap:           0,
        padding:       "6px 6px 6px",
        borderRadius:  8,
        border: `1px solid ${selected ? sc : isActive ? sc + "44" : "rgba(255,255,255,0.05)"}`,
        background: selected
          ? `${sc}18`
          : isActive
          ? `${sc}0a`
          : "rgba(10,14,26,0.8)",
        cursor:     "pointer",
        transition: "all 0.25s ease",
        boxShadow:  isActive
          ? `0 0 18px ${sc}28, inset 0 0 10px ${sc}08`
          : undefined,
        overflow: "hidden",
      }}
    >
      {/* Monitor */}
      <div style={{
        width:        "100%",
        height:       20,
        background:   "#080c18",
        borderRadius: "5px 5px 0 0",
        border:       `1px solid ${isActive ? sc + "55" : "#1a2035"}`,
        borderBottom: "none",
        display:      "flex",
        alignItems:   "center",
        justifyContent: "center",
        position:     "relative",
        overflow:     "hidden",
      }}>
        {isActive && (
          <div style={{
            position:   "absolute",
            inset:      0,
            background: `linear-gradient(180deg, ${sc}22 0%, transparent 100%)`,
          }} />
        )}
        {isActive && (
          <div style={{
            width:      "55%",
            height:     2,
            background: `repeating-linear-gradient(90deg, ${sc}99 0px, ${sc}99 3px, transparent 3px, transparent 6px)`,
            animation:  "typing 1s steps(1) infinite",
          }} />
        )}
        {isDone && (
          <div style={{ width: "60%", height: 1.5, background: `${sc}88`, borderRadius: 1 }} />
        )}
        {isCheckpoint && (
          <span style={{ fontSize: 7, color: sc, fontWeight: 800, letterSpacing: 0.8 }}>
            AGUARDANDO
          </span>
        )}
        {!isActive && !isDone && !isCheckpoint && (
          <div style={{ width: "40%", height: 1, background: "rgba(255,255,255,0.05)", borderRadius: 1 }} />
        )}
      </div>

      {/* Monitor stand */}
      <div style={{ width: 3, height: 3, background: "#111622" }} />

      {/* Desk surface */}
      <div style={{
        width:        "100%",
        height:       4,
        background:   "linear-gradient(180deg, #1e2a42 0%, #182038 100%)",
        borderTop:    "1px solid #2a3450",
        borderBottom: "1px solid #0f1624",
        marginBottom: 5,
      }} />

      {/* Avatar (portrait dentro de circle) */}
      <div style={{
        borderRadius: "50%",
        overflow:     "hidden",
        width:        44,
        height:       44,
        border:       `2.5px solid ${isActive ? sc : selected ? sc + "88" : "rgba(255,255,255,0.08)"}`,
        boxShadow:    isActive ? `0 0 12px ${sc}88, 0 0 4px ${sc}44` : undefined,
        background:   "#080c18",
        transition:   "all 0.3s",
        animation:    isActive ? "float 3s ease-in-out infinite" : undefined,
        flexShrink:   0,
      }}>
        <CharacterPortrait variantIndex={index} status={agent.status} size={44} />
      </div>

      {/* Teclado */}
      <div style={{
        width:        "75%",
        height:       4,
        background:   "#101828",
        borderRadius: 2,
        marginTop:    5,
        border:       "1px solid #1a2538",
        display:      "flex",
        alignItems:   "center",
        justifyContent: "center",
        gap:          1.5,
        flexShrink:   0,
      }}>
        {isActive && Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            style={{
              width:        2.5,
              height:       1.5,
              borderRadius: 0.5,
              background:   sc,
              opacity:      0.5,
              animation:    `typing ${0.7 + i * 0.12}s steps(1) infinite`,
            }}
          />
        ))}
      </div>

      {/* Nome */}
      <div style={{
        marginTop:     5,
        fontSize:      9,
        fontWeight:    700,
        color:         isActive
          ? "var(--text-primary)"
          : selected
          ? "var(--text-primary)"
          : "var(--text-secondary)",
        textAlign:     "center",
        width:         "100%",
        overflow:      "hidden",
        textOverflow:  "ellipsis",
        whiteSpace:    "nowrap",
        letterSpacing: 0.4,
        textTransform: "uppercase",
      }}>
        {agent.name.split(" ")[0]}
      </div>

      {/* Dot status */}
      <div style={{
        position:     "absolute",
        top:          6,
        right:        6,
        width:        6,
        height:       6,
        borderRadius: "50%",
        background:   sc,
        boxShadow:    isActive ? `0 0 6px ${sc}` : undefined,
        animation:    isActive ? "pulse 1.8s infinite" : undefined,
      }} />
    </div>
  );
}

// ─────────────────────────────────────────────
// Room decoration (CSS puro, sem emojis)
// ─────────────────────────────────────────────

function Plant() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div style={{
        width:        10,
        height:       12,
        background:   "linear-gradient(180deg, #3a6a3a, #264a26)",
        borderRadius: "50% 50% 30% 30%",
        position:     "relative",
        boxShadow:    "inset 0 0 4px rgba(0,0,0,0.3)",
      }}>
        <div style={{
          position:     "absolute",
          top:          2,
          left:         -4,
          width:        7,
          height:       9,
          background:   "linear-gradient(180deg, #2e5a2e, #1e3a1e)",
          borderRadius: "50% 30% 50% 30%",
        }} />
        <div style={{
          position:     "absolute",
          top:          2,
          right:        -4,
          width:        7,
          height:       9,
          background:   "linear-gradient(180deg, #366036, #224022)",
          borderRadius: "30% 50% 30% 50%",
        }} />
      </div>
      <div style={{
        width:        10,
        height:       7,
        background:   "linear-gradient(180deg, #8a6040, #6a4820)",
        borderRadius: "0 0 3px 3px",
        borderTop:    "1px solid #6a4830",
        marginTop:    1,
      }} />
    </div>
  );
}

function RoomDecor({ isRunning }: { isRunning: boolean }) {
  return (
    <>
      {/* Parede */}
      <div style={{
        position:     "absolute",
        top:          0,
        left:         0,
        right:        0,
        height:       30,
        background:   "linear-gradient(180deg, #141c2f 0%, #0f1624 100%)",
        borderBottom: "1px solid rgba(255,255,255,0.05)",
      }}>
        {/* Janela CSS */}
        <div style={{
          position:  "absolute",
          top:       4,
          left:      "50%",
          transform: "translateX(-50%)",
          width:     42,
          height:    20,
          border:    "1px solid rgba(255,255,255,0.07)",
          borderRadius: 2,
          background:   isRunning
            ? "linear-gradient(180deg, rgba(0,200,255,0.06), rgba(0,80,160,0.08))"
            : "linear-gradient(180deg, rgba(30,50,90,0.3), rgba(10,20,50,0.4))",
          display:             "grid",
          gridTemplateColumns: "1fr 1px 1fr",
          gridTemplateRows:    "1fr 1px 1fr",
          overflow:            "hidden",
        }}>
          {[0,1,2,3,4,5,6,7,8].map(i => (
            <div key={i} style={{ background: "rgba(255,255,255,0.02)" }} />
          ))}
        </div>
      </div>

      {/* Plantas */}
      <div style={{ position: "absolute", bottom: 42, left: 4 }}><Plant /></div>
      <div style={{ position: "absolute", bottom: 42, right: 4 }}><Plant /></div>

      {/* Chão */}
      <div style={{
        position:   "absolute",
        bottom:     0,
        left:       0,
        right:      0,
        height:     5,
        background: "linear-gradient(90deg, rgba(255,255,255,0.02), rgba(255,255,255,0.05), rgba(255,255,255,0.02))",
        borderTop:  "1px solid rgba(255,255,255,0.04)",
      }} />
    </>
  );
}

// ─────────────────────────────────────────────
// Main OfficePanel
// ─────────────────────────────────────────────

export function OfficePanel() {
  const selectedSquad = useSquadStore((s) => s.selectedSquad);
  const squadInfo     = useSquadStore((s) =>
    s.selectedSquad ? s.squads.get(s.selectedSquad) : undefined
  );
  const state         = useSquadStore((s) =>
    s.selectedSquad ? s.activeStates.get(s.selectedSquad) : undefined
  );
  const selectAgent   = useSquadStore((s) => s.selectAgent);
  const selectedAgent = useSquadStore((s) => s.selectedAgent);

  if (!selectedSquad) {
    return (
      <div style={panelStyle}>
        <EmptyOffice />
      </div>
    );
  }

  // Agents: prefer live state, fall back to static squad config
  const agents: Agent[] = state?.agents?.length
    ? state.agents
    : (squadInfo?.agents ?? []).map((a, i) => ({
        id:        a.id,
        name:      a.name,
        icon:      a.icon ?? "",
        status:    "idle" as const,
        deliverTo: null,
        desk:      { col: (i % 3) + 1, row: Math.floor(i / 3) + 1 },
      }));

  const isRunning = state?.status === "running" || state?.status === "checkpoint";

  return (
    <div style={panelStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <div style={{
          width:        8,
          height:       8,
          borderRadius: "50%",
          background:   isRunning ? "#22c55e" : "#2a3248",
          boxShadow:    isRunning ? "0 0 8px #22c55e" : undefined,
          animation:    isRunning ? "pulse 2s infinite" : undefined,
          flexShrink:   0,
        }} />
        <span style={{
          fontSize:      11,
          fontWeight:    700,
          color:         "var(--text-secondary)",
          textTransform: "uppercase",
          letterSpacing: 1,
        }}>
          Escritório
        </span>
        {isRunning && (
          <span style={{ marginLeft: "auto", fontSize: 9, color: "#22c55e", fontWeight: 700, letterSpacing: 0.5 }}>
            ATIVO
          </span>
        )}
      </div>

      {/* Sala */}
      <div style={roomStyle}>
        <RoomDecor isRunning={isRunning} />

        <div style={desksGridStyle}>
          {agents.length === 0 ? (
            <div style={{ gridColumn: "1/-1", color: "var(--text-secondary)", fontSize: 11, textAlign: "center", padding: "20px 0" }}>
              Squad inativo
            </div>
          ) : (
            agents.map((agent, i) => (
              <AgentDeskCard
                key={agent.id}
                agent={agent}
                index={i}
                selected={selectedAgent === agent.id}
                onClick={() => selectAgent(selectedAgent === agent.id ? null : agent.id)}
              />
            ))
          )}
        </div>
      </div>

      {/* Lista de status */}
      {agents.length > 0 && (
        <div style={{ padding: "8px 10px", borderTop: "1px solid var(--border)", flexShrink: 0 }}>
          {agents.map((agent, i) => {
            const sc       = STATUS_COLORS[agent.status] ?? STATUS_COLORS.idle;
            const isActive = agent.status === "working" || agent.status === "delivering";
            return (
              <div
                key={agent.id}
                onClick={() => selectAgent(selectedAgent === agent.id ? null : agent.id)}
                style={{
                  display:      "flex",
                  alignItems:   "center",
                  gap:          6,
                  padding:      "3px 2px",
                  cursor:       "pointer",
                  borderRadius: 4,
                  opacity:      selectedAgent && selectedAgent !== agent.id ? 0.45 : 1,
                  transition:   "opacity 0.2s",
                }}
              >
                {/* Mini portrait */}
                <div style={{
                  width:        20,
                  height:       20,
                  borderRadius: "50%",
                  overflow:     "hidden",
                  border:       `1.5px solid ${isActive ? sc : "rgba(255,255,255,0.08)"}`,
                  background:   "#080c18",
                  flexShrink:   0,
                }}>
                  <CharacterPortrait variantIndex={i} status={agent.status} size={20} />
                </div>

                <span style={{
                  fontSize:     11,
                  flex:         1,
                  color:        isActive ? "var(--text-primary)" : "var(--text-secondary)",
                  overflow:     "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace:   "nowrap",
                }}>
                  {agent.name}
                </span>

                <span style={{
                  fontSize:      9,
                  color:         sc,
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                  fontWeight:    700,
                  flexShrink:    0,
                }}>
                  {statusLabel(agent.status)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// EmptyOffice
// ─────────────────────────────────────────────

function EmptyOffice() {
  return (
    <div style={{
      flex:           1,
      display:        "flex",
      alignItems:     "center",
      justifyContent: "center",
      flexDirection:  "column",
      gap:            10,
      padding:        16,
    }}>
      <div style={{
        width:        36,
        height:       40,
        background:   "linear-gradient(180deg, #1e2a42, #141c2f)",
        borderRadius: "4px 4px 0 0",
        border:       "1px solid #2a3448",
        display:      "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gridTemplateRows:    "repeat(4, 1fr)",
        gap:          2,
        padding:      3,
        opacity:      0.5,
      }}>
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} style={{
            background:   i % 3 === 0 ? "rgba(0,200,255,0.15)" : "rgba(255,255,255,0.04)",
            borderRadius: 1,
          }} />
        ))}
      </div>
      <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>
        Selecione um squad
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function statusLabel(status: string) {
  return (
    {
      working:    "ativo",
      checkpoint: "aguarda",
      done:       "feito",
      idle:       "ocioso",
      delivering: "enviando",
    }[status] ?? status
  );
}

// ─────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────

const panelStyle: React.CSSProperties = {
  width:         220,
  minWidth:      220,
  height:        "100%",
  background:    "#080c18",
  borderLeft:    "1px solid var(--border)",
  display:       "flex",
  flexDirection: "column",
  overflow:      "hidden",
};

const headerStyle: React.CSSProperties = {
  display:      "flex",
  alignItems:   "center",
  gap:          8,
  padding:      "9px 12px",
  borderBottom: "1px solid var(--border)",
  background:   "rgba(255,255,255,0.02)",
  flexShrink:   0,
};

const roomStyle: React.CSSProperties = {
  flex:       1,
  position:   "relative",
  overflow:   "hidden",
  padding:    "36px 8px 52px",
  background: "linear-gradient(180deg, #0d1221 0%, #080c18 100%)",
};

const desksGridStyle: React.CSSProperties = {
  display:             "grid",
  gridTemplateColumns: "repeat(3, 1fr)",
  gap:                 6,
  position:            "relative",
  zIndex:              1,
};
