import { useState } from "react";
import { useSquadStore } from "@/store/useSquadStore";

export function SquadToolbar() {
  const selectedSquad = useSquadStore((s) => s.selectedSquad);
  const squadInfo = useSquadStore((s) =>
    s.selectedSquad ? s.squads.get(s.selectedSquad) : undefined
  );
  const state = useSquadStore((s) =>
    s.selectedSquad ? s.activeStates.get(s.selectedSquad) : undefined
  );
  const startSquad = useSquadStore((s) => s.startSquad);
  const stopSquad = useSquadStore((s) => s.stopSquad);
  const [loading, setLoading] = useState(false);

  const isRunning = state?.status === "running" || state?.status === "checkpoint";

  const handleStart = async () => {
    if (!selectedSquad || loading) return;
    setLoading(true);
    await startSquad(selectedSquad);
    setLoading(false);
  };

  const handleStop = async () => {
    if (!selectedSquad || loading) return;
    setLoading(true);
    await stopSquad(selectedSquad);
    setLoading(false);
  };

  return (
    <div style={toolbarStyle}>
      {/* Squad identity */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
        {squadInfo ? (
          <>
            <span style={{ fontSize: 18 }}>{squadInfo.icon}</span>
            <span style={{ fontWeight: 600, fontSize: 13, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {squadInfo.name}
            </span>
            {state && (
              <span
                style={{
                  fontSize: 11,
                  padding: "2px 8px",
                  borderRadius: 10,
                  background: statusBg(state.status),
                  color: statusColor(state.status),
                  fontWeight: 600,
                  letterSpacing: 0.5,
                  textTransform: "uppercase",
                  flexShrink: 0,
                }}
              >
                {statusLabel(state.status)}
              </span>
            )}
          </>
        ) : (
          <span style={{ color: "var(--text-secondary)", fontSize: 13 }}>
            Nenhum squad selecionado
          </span>
        )}
      </div>

      {/* Controls */}
      <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
        {selectedSquad && (
          <>
            {!isRunning ? (
              <ToolbarButton
                onClick={handleStart}
                disabled={loading}
                color="var(--accent-green)"
                title="Ativar Squad"
              >
                {loading ? "⏳" : "▶"} Ativar
              </ToolbarButton>
            ) : (
              <ToolbarButton
                onClick={handleStop}
                disabled={loading}
                color="var(--accent-red)"
                title="Parar Squad"
              >
                {loading ? "⏳" : "⏹"} Parar
              </ToolbarButton>
            )}
            <ToolbarButton
              onClick={handleStart}
              disabled={loading || isRunning}
              color="var(--accent-cyan)"
              title="Rodar pipeline manual"
            >
              🔄 Pipeline
            </ToolbarButton>
          </>
        )}
      </div>

      {/* Step progress */}
      {state && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--text-secondary)", flexShrink: 0 }}>
          <ProgressBar current={state.step.current} total={state.step.total} />
          <span>
            {state.step.current}/{state.step.total} — {state.step.label}
          </span>
        </div>
      )}
    </div>
  );
}

function ToolbarButton({
  children,
  onClick,
  disabled,
  color,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  color: string;
  title?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 4,
        padding: "5px 12px",
        background: disabled ? "transparent" : "rgba(255,255,255,0.05)",
        border: `1px solid ${disabled ? "var(--border)" : color}`,
        borderRadius: 6,
        color: disabled ? "var(--text-secondary)" : color,
        cursor: disabled ? "not-allowed" : "pointer",
        fontSize: 12,
        fontFamily: "inherit",
        fontWeight: 600,
        transition: "all 0.15s ease",
        letterSpacing: 0.3,
      }}
    >
      {children}
    </button>
  );
}

function ProgressBar({ current, total }: { current: number; total: number }) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;
  return (
    <div
      style={{
        width: 80,
        height: 4,
        background: "var(--border)",
        borderRadius: 2,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: `${pct}%`,
          height: "100%",
          background: "var(--accent-cyan)",
          borderRadius: 2,
          transition: "width 0.3s ease",
        }}
      />
    </div>
  );
}

function statusBg(status: string) {
  switch (status) {
    case "running": return "rgba(0, 230, 118, 0.15)";
    case "checkpoint": return "rgba(255, 171, 0, 0.15)";
    case "completed": return "rgba(0, 212, 255, 0.15)";
    default: return "rgba(136, 136, 160, 0.15)";
  }
}

function statusColor(status: string) {
  switch (status) {
    case "running": return "var(--accent-green)";
    case "checkpoint": return "var(--accent-amber)";
    case "completed": return "var(--accent-cyan)";
    default: return "var(--text-secondary)";
  }
}

function statusLabel(status: string) {
  switch (status) {
    case "running": return "Rodando";
    case "checkpoint": return "Aguardando";
    case "completed": return "Concluído";
    default: return status;
  }
}

const toolbarStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 16,
  padding: "0 16px",
  height: 44,
  minHeight: 44,
  borderBottom: "1px solid var(--border)",
  background: "var(--bg-sidebar)",
  overflow: "hidden",
};
