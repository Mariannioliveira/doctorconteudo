import { useEffect, useRef } from "react";
import { useRunStore } from "@/store/useRunStore";
import { useRunStream } from "@/hooks/useRunStream";
import type { RunListItem } from "@/types/run";

// ─────────────────────────────────────────────
//  RunPanel — right sidebar: start run + live output + history
// ─────────────────────────────────────────────

export function RunPanel() {
  const runs = useRunStore((s) => s.runs);
  const activeRunId = useRunStore((s) => s.activeRunId);
  const liveOutput = useRunStore((s) => s.liveOutput);
  const currentAgent = useRunStore((s) => s.currentAgent);
  const runError = useRunStore((s) => s.runError);
  const checkpoint = useRunStore((s) => s.checkpoint);
  const setRuns = useRunStore((s) => s.setRuns);
  const addRun = useRunStore((s) => s.addRun);
  const setActiveRun = useRunStore((s) => s.setActiveRun);

  // Connect SSE for the active run
  useRunStream(activeRunId);

  // Load existing runs on mount
  useEffect(() => {
    fetch("/api/runs")
      .then((r) => r.json())
      .then((d) => setRuns(d.runs ?? []))
      .catch(() => {});
  }, [setRuns]);

  // Auto-scroll live output
  const outputRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [liveOutput]);

  const startRun = async () => {
    try {
      const res = await fetch("/api/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ squad: "conteudo-social-medicos" }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      const newRun: RunListItem = {
        run_id: data.run_id,
        squad: data.squad,
        status: "running",
        started_at: new Date().toISOString(),
        current_step: null,
      };
      addRun(newRun);
      setActiveRun(data.run_id);
    } catch (err) {
      console.error("Failed to start run:", err);
    }
  };

  const activeRun = runs.find((r) => r.run_id === activeRunId);
  const isRunning = activeRun?.status === "running";
  const isCheckpoint = activeRun?.status === "checkpoint";
  const isDone =
    activeRun?.status === "completed" || activeRun?.status === "saved_draft";
  const isError = activeRun?.status === "error";

  return (
    <aside style={panelStyle}>
      {/* Header */}
      <div style={sectionHeaderStyle}>Rodadas</div>

      {/* Start button */}
      <div style={{ padding: "8px 12px" }}>
        <button
          onClick={startRun}
          disabled={isRunning || isCheckpoint}
          style={startBtnStyle(isRunning || isCheckpoint)}
        >
          {isRunning ? "⏳ Executando…" : isCheckpoint ? "⏸ Aguardando decisão" : "▶ Iniciar nova rodada"}
        </button>
      </div>

      {/* Active run live output */}
      {activeRunId && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {/* Agent name */}
          {currentAgent && (
            <div style={agentLabelStyle}>
              <span>{currentAgent.icon}</span>
              <span style={{ fontWeight: 600 }}>{currentAgent.name}</span>
              <span style={blinkDotStyle} />
            </div>
          )}

          {/* Checkpoint badge */}
          {isCheckpoint && !currentAgent && (
            <div style={checkpointBadgeStyle}>⏸ Aguardando decisão</div>
          )}

          {/* Completion badge */}
          {isDone && (
            <div style={{ ...checkpointBadgeStyle, background: "rgba(80,200,120,0.12)", color: "#50c878" }}>
              ✓ {activeRun?.status === "saved_draft" ? "Rascunho salvo" : "Concluído"}
            </div>
          )}

          {/* Error badge */}
          {isError && (
            <div style={{ ...checkpointBadgeStyle, background: "rgba(255,80,80,0.12)", color: "#ff5050" }}>
              ✗ Erro: {runError ?? "Falha no pipeline"}
            </div>
          )}

          {/* Live output */}
          {liveOutput && (
            <div ref={outputRef} style={outputStyle}>
              <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                {liveOutput}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* Run history */}
      <div style={{ borderTop: "1px solid var(--border)", overflowY: "auto", maxHeight: activeRunId ? 220 : undefined, flex: activeRunId ? undefined : 1 }}>
        <div style={{ ...sectionHeaderStyle, paddingTop: 12 }}>Histórico</div>
        {runs.length === 0 && (
          <div style={{ padding: "8px 12px", color: "var(--text-secondary)", fontSize: 12 }}>
            Nenhuma rodada ainda
          </div>
        )}
        {runs.map((run) => (
          <RunHistoryItem
            key={run.run_id}
            run={run}
            isActive={run.run_id === activeRunId}
            onClick={() => setActiveRun(run.run_id)}
          />
        ))}
      </div>
    </aside>
  );
}

// ─────────────────────────────────────────────
//  Run history row
// ─────────────────────────────────────────────

function RunHistoryItem({
  run,
  isActive,
  onClick,
}: {
  run: RunListItem;
  isActive: boolean;
  onClick: () => void;
}) {
  const { color, label } = statusMeta(run.status);
  const started = run.started_at
    ? new Date(run.started_at).toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

  return (
    <div
      onClick={onClick}
      style={{
        padding: "8px 12px",
        cursor: "pointer",
        background: isActive ? "rgba(146,173,255,0.08)" : "transparent",
        borderLeft: isActive ? "2px solid #92adff" : "2px solid transparent",
        transition: "background 0.15s",
      }}
      onMouseEnter={(e) => {
        if (!isActive) (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.03)";
      }}
      onMouseLeave={(e) => {
        if (!isActive) (e.currentTarget as HTMLDivElement).style.background = "transparent";
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 11, color, fontWeight: 600 }}>{label}</span>
        <span style={{ fontSize: 10, color: "var(--text-secondary)" }}>{started}</span>
      </div>
      <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2, fontFamily: "monospace" }}>
        {run.run_id}
      </div>
      {run.current_step && (
        <div style={{ fontSize: 10, color: "var(--text-secondary)", marginTop: 1 }}>
          {run.current_step}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────

function statusMeta(status: RunListItem["status"]) {
  switch (status) {
    case "running":
      return { color: "#92adff", label: "● Executando" };
    case "checkpoint":
      return { color: "#f5c842", label: "⏸ Checkpoint" };
    case "completed":
      return { color: "#50c878", label: "✓ Concluído" };
    case "saved_draft":
      return { color: "#50c878", label: "✓ Rascunho salvo" };
    case "error":
      return { color: "#ff5050", label: "✗ Erro" };
    default:
      return { color: "var(--text-secondary)", label: status };
  }
}

// ─────────────────────────────────────────────
//  Styles
// ─────────────────────────────────────────────

const panelStyle: React.CSSProperties = {
  width: 280,
  minWidth: 280,
  height: "100%",
  background: "var(--bg-sidebar)",
  borderLeft: "1px solid var(--border)",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
};

const sectionHeaderStyle: React.CSSProperties = {
  padding: "12px 12px 4px",
  fontSize: 11,
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: 1,
  color: "var(--text-secondary)",
};

const startBtnStyle = (disabled: boolean): React.CSSProperties => ({
  width: "100%",
  padding: "8px 12px",
  background: disabled ? "rgba(146,173,255,0.08)" : "#92adff",
  color: disabled ? "var(--text-secondary)" : "#0d0d0f",
  border: "none",
  borderRadius: 6,
  fontSize: 13,
  fontWeight: 600,
  cursor: disabled ? "not-allowed" : "pointer",
  transition: "background 0.15s",
});

const agentLabelStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  padding: "6px 12px",
  fontSize: 12,
  color: "#92adff",
};

const blinkDotStyle: React.CSSProperties = {
  width: 6,
  height: 6,
  borderRadius: "50%",
  background: "#92adff",
  animation: "pulse 1.2s infinite",
  marginLeft: 2,
};

const checkpointBadgeStyle: React.CSSProperties = {
  margin: "4px 12px",
  padding: "6px 10px",
  borderRadius: 6,
  background: "rgba(245,200,66,0.1)",
  color: "#f5c842",
  fontSize: 12,
  fontWeight: 600,
};

const outputStyle: React.CSSProperties = {
  flex: 1,
  overflowY: "auto",
  padding: "8px 12px",
  fontSize: 11,
  lineHeight: 1.6,
  color: "var(--text-secondary)",
  background: "rgba(0,0,0,0.2)",
  margin: "4px 8px",
  borderRadius: 6,
};
