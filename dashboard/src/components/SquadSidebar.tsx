import { useState } from "react";
import { useSquadStore } from "@/store/useSquadStore";
import { CharacterPortrait } from "@/components/CharacterPortrait";

export function SquadSidebar() {
  const squads = useSquadStore((s) => s.squads);
  const activeStates = useSquadStore((s) => s.activeStates);
  const selectedSquad = useSquadStore((s) => s.selectedSquad);
  const selectedAgent = useSquadStore((s) => s.selectedAgent);
  const selectSquad = useSquadStore((s) => s.selectSquad);
  const selectAgent = useSquadStore((s) => s.selectAgent);
  const startSquad = useSquadStore((s) => s.startSquad);
  const stopSquad = useSquadStore((s) => s.stopSquad);
  const addMessage = useSquadStore((s) => s.addMessage);
  const [loadingSquad, setLoadingSquad] = useState<string | null>(null);

  const squadList = Array.from(squads.values()).sort((a, b) => {
    const aActive = activeStates.has(a.code) ? 0 : 1;
    const bActive = activeStates.has(b.code) ? 0 : 1;
    if (aActive !== bActive) return aActive - bActive;
    return a.name.localeCompare(b.name);
  });

  return (
    <aside style={sidebarStyle}>
      <div style={sectionHeader}>Squads</div>

      <div style={{ flex: 1, overflowY: "auto" }}>
        {squadList.length === 0 && (
          <div style={{ padding: "16px 12px", color: "var(--text-secondary)", fontSize: 12 }}>
            Nenhum squad encontrado
          </div>
        )}

        {squadList.map((squad) => {
          const state = activeStates.get(squad.code);
          const isSelected = selectedSquad === squad.code;
          const isRunning = state?.status === "running" || state?.status === "checkpoint";

          return (
            <div key={squad.code}>
              {/* Squad header row */}
              <button
                onClick={() => selectSquad(isSelected ? null : squad.code)}
                style={{
                  ...squadRowStyle,
                  background: isSelected ? "rgba(0,212,255,0.07)" : "transparent",
                  borderLeft: isSelected
                    ? "3px solid var(--accent-cyan)"
                    : "3px solid transparent",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
                  <RunDot running={isRunning} />
                  <span style={{ fontSize: 16 }}>{squad.icon}</span>
                  <span
                    style={{
                      flex: 1,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      fontSize: 13,
                      fontWeight: isSelected ? 700 : 500,
                      color: isRunning ? "var(--text-primary)" : "var(--text-secondary)",
                    }}
                  >
                    {squad.name}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                  {state?.step && (
                    <span style={{ fontSize: 10, color: "var(--text-secondary)" }}>
                      {state.step.current}/{state.step.total}
                    </span>
                  )}
                  <span style={{ color: "var(--text-secondary)", fontSize: 10 }}>
                    {isSelected ? "▲" : "▼"}
                  </span>
                </div>
              </button>

              {/* Expanded: agents */}
              {isSelected && (
                <div style={{ background: "rgba(0,0,0,0.15)", borderBottom: "1px solid var(--border)" }}>
                  {/* Squad controls */}
                  <div style={{ display: "flex", gap: 6, padding: "8px 12px 4px" }}>
                    {!isRunning ? (
                      <SquadBtn
                        color="var(--accent-green)"
                        loading={loadingSquad === squad.code}
                        onClick={async () => {
                          setLoadingSquad(squad.code);
                          const result = await startSquad(squad.code);
                          if (result?.error) {
                            addMessage(squad.code, {
                              id: `err-${Date.now()}`,
                              type: "system",
                              content: `Erro ao iniciar: ${result.error}`,
                              variant: "error",
                              timestamp: new Date().toISOString(),
                            });
                          }
                          setLoadingSquad(null);
                        }}
                      >
                        ▶ Ativar
                      </SquadBtn>
                    ) : (
                      <SquadBtn
                        color="var(--accent-red)"
                        loading={loadingSquad === squad.code}
                        onClick={async () => {
                          setLoadingSquad(squad.code);
                          await stopSquad(squad.code);
                          setLoadingSquad(null);
                        }}
                      >
                        ⏹ Parar
                      </SquadBtn>
                    )}
                  </div>

                  {/* Agent list */}
                  <div style={{ paddingBottom: 6 }}>
                    <div style={{ ...agentSectionLabel }}>Agentes</div>
                    {state?.agents?.length ? (
                      state.agents.map((agent, agentIdx) => (
                        <button
                          key={agent.id}
                          onClick={() => selectAgent(selectedAgent === agent.id ? null : agent.id)}
                          style={{
                            ...agentRowStyle,
                            background:
                              selectedAgent === agent.id
                                ? "rgba(0,212,255,0.08)"
                                : "transparent",
                          }}
                        >
                          <AgentStatusDot status={agent.status} />
                          <div style={{ width: 22, height: 22, borderRadius: "50%", overflow: "hidden", flexShrink: 0 }}>
                            <CharacterPortrait variantIndex={agentIdx} status={agent.status} size={22} />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div
                              style={{
                                fontSize: 12,
                                fontWeight: selectedAgent === agent.id ? 700 : 500,
                                color: "var(--text-primary)",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {agent.name}
                            </div>
                            <div style={{ fontSize: 10, color: statusColor(agent.status), marginTop: 1 }}>
                              {statusLabel(agent.status)}
                            </div>
                          </div>
                          {selectedAgent === agent.id && (
                            <span style={{ fontSize: 10, color: "var(--accent-cyan)" }}>●</span>
                          )}
                        </button>
                      ))
                    ) : (
                      // Static agents from squad yaml (not running)
                      squad.agents.map((agent, agentIdx) => (
                        <button
                          key={agent.id}
                          onClick={() => selectAgent(selectedAgent === agent.id ? null : agent.id)}
                          style={{
                            ...agentRowStyle,
                            background:
                              selectedAgent === agent.id
                                ? "rgba(0,212,255,0.08)"
                                : "transparent",
                          }}
                        >
                          <AgentStatusDot status="idle" />
                          <div style={{ width: 22, height: 22, borderRadius: "50%", overflow: "hidden", flexShrink: 0 }}>
                            <CharacterPortrait variantIndex={agentIdx} status="idle" size={22} />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div
                              style={{
                                fontSize: 12,
                                fontWeight: 500,
                                color: "var(--text-secondary)",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {agent.name}
                            </div>
                            <div style={{ fontSize: 10, color: "var(--text-secondary)", marginTop: 1 }}>
                              ocioso
                            </div>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
}

function RunDot({ running }: { running: boolean }) {
  return (
    <span
      style={{
        width: 7,
        height: 7,
        borderRadius: "50%",
        background: running ? "var(--accent-green)" : "#333348",
        flexShrink: 0,
        boxShadow: running ? "0 0 6px var(--accent-green)" : undefined,
      }}
    />
  );
}

function AgentStatusDot({ status }: { status: string }) {
  return (
    <span
      style={{
        width: 6,
        height: 6,
        borderRadius: "50%",
        background: statusColor(status),
        flexShrink: 0,
        boxShadow:
          status === "working" ? `0 0 5px ${statusColor(status)}` : undefined,
      }}
    />
  );
}

function SquadBtn({
  children,
  color,
  loading,
  onClick,
}: {
  children: React.ReactNode;
  color: string;
  loading?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      style={{
        flex: 1,
        padding: "4px 0",
        background: loading ? `${color}18` : "transparent",
        border: `1px solid ${loading ? color + "66" : color}`,
        borderRadius: 5,
        color: loading ? color + "aa" : color,
        fontSize: 11,
        fontWeight: 700,
        fontFamily: "inherit",
        cursor: loading ? "wait" : "pointer",
        letterSpacing: 0.3,
        transition: "all 0.2s",
      }}
    >
      {loading ? "..." : children}
    </button>
  );
}

function statusColor(status: string) {
  switch (status) {
    case "working": return "var(--accent-green)";
    case "checkpoint": return "var(--accent-amber)";
    case "done": return "var(--accent-cyan)";
    case "delivering": return "var(--accent-green)";
    default: return "#444458";
  }
}

function statusLabel(status: string) {
  switch (status) {
    case "working": return "trabalhando";
    case "checkpoint": return "aguardando input";
    case "done": return "concluído";
    case "delivering": return "entregando";
    case "idle": return "ocioso";
    default: return status;
  }
}

const sidebarStyle: React.CSSProperties = {
  width: 240,
  minWidth: 240,
  height: "100%",
  background: "var(--bg-sidebar)",
  borderRight: "1px solid var(--border)",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
};

const sectionHeader: React.CSSProperties = {
  padding: "12px 12px 8px",
  fontSize: 10,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: 1.2,
  color: "var(--text-secondary)",
  borderBottom: "1px solid var(--border)",
};

const squadRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 0,
  width: "100%",
  padding: "10px 12px",
  border: "none",
  cursor: "pointer",
  textAlign: "left",
  fontFamily: "inherit",
  transition: "all 0.15s ease",
};

const agentRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  width: "100%",
  padding: "7px 16px",
  border: "none",
  cursor: "pointer",
  textAlign: "left",
  fontFamily: "inherit",
  transition: "background 0.1s",
};

const agentSectionLabel: React.CSSProperties = {
  fontSize: 9,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: 1,
  color: "var(--text-secondary)",
  padding: "4px 16px 4px",
  opacity: 0.7,
};
