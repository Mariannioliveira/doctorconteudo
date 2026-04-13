import { useEffect, useState } from "react";
import { useSquadStore } from "@/store/useSquadStore";

interface Metrics {
  total_runs: number;
  completed_runs: number;
  today_runs: number;
  approval_rate: number;
  avg_steps_per_run: number;
  is_running: boolean;
}

export function MetricsPanel() {
  const selectedSquad = useSquadStore((s) => s.selectedSquad);
  const state = useSquadStore((s) =>
    s.selectedSquad ? s.activeStates.get(s.selectedSquad) : undefined
  );
  const [metrics, setMetrics] = useState<Metrics | null>(null);

  useEffect(() => {
    if (!selectedSquad) { setMetrics(null); return; }
    fetch(`/api/squads/${selectedSquad}/metrics`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => d && setMetrics(d))
      .catch(() => null);
  }, [selectedSquad, state?.status]);

  if (!selectedSquad || !metrics) return null;

  // Find bottleneck agent (longest-running or checkpoint-waiting)
  const bottleneck = state?.agents?.find((a) => a.status === "checkpoint")
    ?? state?.agents?.find((a) => a.status === "working");

  return (
    <aside style={panelStyle}>
      <div style={sectionLabel}>Métricas do Squad</div>

      <MetricRow label="Hoje" value={String(metrics.today_runs)} unit="runs" accent="var(--accent-cyan)" />
      <MetricRow label="Total" value={String(metrics.total_runs)} unit="runs" />
      <MetricRow label="Aprovação" value={`${metrics.approval_rate}%`} accent={metrics.approval_rate >= 70 ? "var(--accent-green)" : "var(--accent-amber)"} />
      <MetricRow label="Passos médios" value={String(metrics.avg_steps_per_run)} />

      <div style={{ height: 1, background: "var(--border)", margin: "12px 0" }} />

      <div style={sectionLabel}>Agentes Ativos</div>

      {state?.agents ? (
        state.agents.map((agent) => (
          <AgentStatusRow
            key={agent.id}
            icon={agent.icon}
            name={agent.name}
            status={agent.status}
          />
        ))
      ) : (
        <div style={{ fontSize: 11, color: "var(--text-secondary)", padding: "4px 0" }}>
          Squad inativo
        </div>
      )}

      {bottleneck && (
        <>
          <div style={{ height: 1, background: "var(--border)", margin: "12px 0" }} />
          <div style={sectionLabel}>Gargalo</div>
          <div
            style={{
              fontSize: 12,
              color: "var(--accent-amber)",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <span>{bottleneck.icon}</span>
            <span>{bottleneck.name}</span>
            <span style={{ color: "var(--text-secondary)" }}>
              {bottleneck.status === "checkpoint" ? "aguardando input" : "processando"}
            </span>
          </div>
        </>
      )}
    </aside>
  );
}

function MetricRow({
  label,
  value,
  unit,
  accent,
}: {
  label: string;
  value: string;
  unit?: string;
  accent?: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        padding: "4px 0",
        fontSize: 12,
      }}
    >
      <span style={{ color: "var(--text-secondary)" }}>{label}</span>
      <span style={{ color: accent ?? "var(--text-primary)", fontWeight: 600 }}>
        {value}
        {unit && <span style={{ color: "var(--text-secondary)", fontWeight: 400, marginLeft: 3 }}>{unit}</span>}
      </span>
    </div>
  );
}

function AgentStatusRow({
  icon,
  name,
  status,
}: {
  icon: string;
  name: string;
  status: string;
}) {
  const dot = statusDot(status);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "3px 0",
        fontSize: 12,
      }}
    >
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: "50%",
          background: dot,
          flexShrink: 0,
          boxShadow: status === "working" ? `0 0 6px ${dot}` : undefined,
        }}
      />
      <span style={{ fontSize: 13 }}>{icon}</span>
      <span style={{ color: "var(--text-primary)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {name}
      </span>
      <span style={{ fontSize: 10, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: 0.5 }}>
        {statusLabel(status)}
      </span>
    </div>
  );
}

function statusDot(status: string) {
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
    case "working": return "Ativo";
    case "checkpoint": return "Aguarda";
    case "done": return "Feito";
    case "delivering": return "Enviando";
    case "idle": return "Ocioso";
    default: return status;
  }
}

const panelStyle: React.CSSProperties = {
  width: 200,
  minWidth: 200,
  height: "100%",
  background: "var(--bg-sidebar)",
  borderLeft: "1px solid var(--border)",
  padding: "16px 14px",
  display: "flex",
  flexDirection: "column",
  gap: 0,
  overflowY: "auto",
};

const sectionLabel: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: 1,
  color: "var(--text-secondary)",
  marginBottom: 8,
};
