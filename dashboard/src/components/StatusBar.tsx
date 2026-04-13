import { useEffect, useState } from "react";
import { useSquadStore } from "@/store/useSquadStore";
import { formatElapsed } from "@/lib/formatTime";

export function StatusBar() {
  const selectedSquad = useSquadStore((s) => s.selectedSquad);
  const squadInfo = useSquadStore((s) =>
    s.selectedSquad ? s.squads.get(s.selectedSquad) : undefined
  );
  const state = useSquadStore((s) =>
    s.selectedSquad ? s.activeStates.get(s.selectedSquad) : undefined
  );
  const isConnected = useSquadStore((s) => s.isConnected);
  const startSquad = useSquadStore((s) => s.startSquad);
  const stopSquad = useSquadStore((s) => s.stopSquad);
  const [loading, setLoading] = useState(false);

  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!state?.startedAt) { setElapsed(0); return; }
    const startTime = new Date(state.startedAt).getTime();
    const tick = () => setElapsed(Date.now() - startTime);
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [state?.startedAt]);

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
    <footer style={footerStyle}>
      {/* Left: squad identity + controls */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
        {squadInfo && (
          <>
            <span style={{ fontSize: 15 }}>{squadInfo.icon}</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>
              {squadInfo.name}
            </span>
          </>
        )}

        {selectedSquad && (
          <>
            {!isRunning ? (
              <FooterBtn
                onClick={handleStart}
                disabled={loading}
                color="var(--accent-green)"
              >
                ▶ Ativar
              </FooterBtn>
            ) : (
              <FooterBtn
                onClick={handleStop}
                disabled={loading}
                color="var(--accent-red)"
              >
                ⏹ Parar
              </FooterBtn>
            )}
          </>
        )}

        {state && (
          <>
            <span
              style={{
                fontSize: 10,
                padding: "2px 8px",
                borderRadius: 10,
                background: statusBg(state.status),
                color: statusColor(state.status),
                fontWeight: 700,
                letterSpacing: 0.5,
                textTransform: "uppercase",
              }}
            >
              {statusLabel(state.status)}
            </span>
            <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
              {state.step.current}/{state.step.total} — {state.step.label}
            </span>
            {state.startedAt && (
              <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                {formatElapsed(elapsed)}
              </span>
            )}
          </>
        )}

        {!selectedSquad && (
          <span style={{ color: "var(--text-secondary)", fontSize: 12 }}>
            Selecione um squad na sidebar
          </span>
        )}
      </div>

      {/* Right: connection indicator */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
        <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>
          {isConnected ? "conectado" : "desconectado"}
        </span>
        <span
          style={{
            width: 7,
            height: 7,
            borderRadius: "50%",
            background: isConnected ? "var(--accent-green)" : "var(--accent-red)",
            boxShadow: isConnected ? "0 0 5px var(--accent-green)" : undefined,
          }}
        />
      </div>
    </footer>
  );
}

function FooterBtn({
  children,
  onClick,
  disabled,
  color,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  color: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: "3px 10px",
        background: "transparent",
        border: `1px solid ${disabled ? "var(--border)" : color}`,
        borderRadius: 5,
        color: disabled ? "var(--text-secondary)" : color,
        cursor: disabled ? "not-allowed" : "pointer",
        fontSize: 11,
        fontFamily: "inherit",
        fontWeight: 700,
        letterSpacing: 0.3,
      }}
    >
      {children}
    </button>
  );
}

function statusBg(status: string) {
  switch (status) {
    case "running": return "rgba(0,230,118,0.12)";
    case "checkpoint": return "rgba(255,171,0,0.12)";
    case "completed": return "rgba(0,212,255,0.12)";
    default: return "rgba(136,136,160,0.12)";
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

const footerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "0 16px",
  borderTop: "1px solid var(--border)",
  background: "var(--bg-sidebar)",
  fontSize: 12,
  height: 38,
  minHeight: 38,
  flexShrink: 0,
};
