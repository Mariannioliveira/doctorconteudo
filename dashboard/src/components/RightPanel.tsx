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

interface AgentDetails {
  id: string;
  name: string;
  icon: string;
  status: string;
  role: string;
  skills: string[];
  model_tier: string;
  description: string;
  recentActivity: {
    run_id: string;
    started_at: string;
    steps_completed: string[];
    run_status: string;
  }[];
  latestOutputs: {
    file: string;
    content: string;
    step: string;
  }[];
}

interface RunItem {
  run_id: string;
  status: string;
  started_at: string;
  steps_done: number;
  steps_total: number;
}

export function RightPanel() {
  const selectedSquad = useSquadStore((s) => s.selectedSquad);
  const selectedAgent = useSquadStore((s) => s.selectedAgent);
  const squadState = useSquadStore((s) =>
    s.selectedSquad ? s.activeStates.get(s.selectedSquad) : undefined
  );

  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [agentDetails, setAgentDetails] = useState<AgentDetails | null>(null);
  const [runs, setRuns] = useState<RunItem[]>([]);
  const [activeTab, setActiveTab] = useState<"overview" | "outputs" | "runs">("overview");

  // Fetch metrics
  useEffect(() => {
    if (!selectedSquad) { setMetrics(null); return; }
    fetch(`/api/squads/${selectedSquad}/metrics`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => d && setMetrics(d))
      .catch(() => null);
  }, [selectedSquad, squadState?.status]);

  // Fetch runs
  useEffect(() => {
    if (!selectedSquad) { setRuns([]); return; }
    fetch(`/api/squads/${selectedSquad}/runs`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => Array.isArray(d) && setRuns(d.slice(0, 10)))
      .catch(() => null);
  }, [selectedSquad, squadState?.status]);

  // Fetch agent details
  useEffect(() => {
    if (!selectedSquad || !selectedAgent) { setAgentDetails(null); return; }
    fetch(`/api/squads/${selectedSquad}/agents/${selectedAgent}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => d && setAgentDetails(d))
      .catch(() => null);
  }, [selectedSquad, selectedAgent, squadState?.status]);

  // Switch to agent info tab automatically when agent selected
  useEffect(() => {
    if (selectedAgent) setActiveTab("overview");
  }, [selectedAgent]);

  if (!selectedSquad) {
    return (
      <aside style={panelStyle}>
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
            Selecione um squad
          </span>
        </div>
      </aside>
    );
  }

  const liveAgent = squadState?.agents?.find((a) => a.id === selectedAgent);

  return (
    <aside style={panelStyle}>
      {/* Panel header */}
      <div style={panelHeader}>
        {selectedAgent && agentDetails ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 20 }}>{agentDetails.icon}</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 13 }}>{agentDetails.name}</div>
              {agentDetails.role && (
                <div style={{ fontSize: 10, color: "var(--text-secondary)" }}>{agentDetails.role}</div>
              )}
            </div>
            {liveAgent && <StatusPill status={liveAgent.status} />}
          </div>
        ) : (
          <span style={{ fontWeight: 700, fontSize: 12, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: 1 }}>
            Painel
          </span>
        )}
      </div>

      {/* Tabs */}
      <div style={tabBar}>
        <TabBtn active={activeTab === "overview"} onClick={() => setActiveTab("overview")}>
          {selectedAgent ? "Info" : "Visão Geral"}
        </TabBtn>
        <TabBtn active={activeTab === "outputs"} onClick={() => setActiveTab("outputs")}>
          Outputs
        </TabBtn>
        <TabBtn active={activeTab === "runs"} onClick={() => setActiveTab("runs")}>
          Histórico
        </TabBtn>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: "auto", padding: "12px" }}>

        {/* ── OVERVIEW TAB ── */}
        {activeTab === "overview" && (
          <>
            {selectedAgent && agentDetails ? (
              <AgentInfoView details={agentDetails} />
            ) : (
              <SquadOverview metrics={metrics} squadState={squadState} />
            )}
          </>
        )}

        {/* ── OUTPUTS TAB ── */}
        {activeTab === "outputs" && (
          <OutputsView
            agentDetails={selectedAgent ? agentDetails : null}
            selectedSquad={selectedSquad}
            squadState={squadState}
          />
        )}

        {/* ── RUNS TAB ── */}
        {activeTab === "runs" && (
          <RunsView runs={runs} />
        )}
      </div>
    </aside>
  );
}

// ─────────────────────────────────────────────
// Sub-views
// ─────────────────────────────────────────────

function SquadOverview({
  metrics,
  squadState,
}: {
  metrics: Metrics | null;
  squadState: ReturnType<typeof useSquadStore.getState>["activeStates"] extends Map<string, infer V> ? V | undefined : never;
}) {
  const isRunning = squadState?.status === "running" || squadState?.status === "checkpoint";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Status */}
      {squadState && (
        <div style={card}>
          <SectionLabel>Status atual</SectionLabel>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <StatusPill status={squadState.status} />
            <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
              Passo {squadState.step.current}/{squadState.step.total}
            </span>
          </div>
          <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 4 }}>
            {squadState.step.label}
          </div>
          {/* Progress bar */}
          <div style={{ height: 4, background: "var(--border)", borderRadius: 2, marginTop: 8, overflow: "hidden" }}>
            <div
              style={{
                height: "100%",
                width: `${squadState.step.total > 0 ? (squadState.step.current / squadState.step.total) * 100 : 0}%`,
                background: isRunning ? "var(--accent-green)" : "var(--accent-cyan)",
                borderRadius: 2,
                transition: "width 0.4s ease",
              }}
            />
          </div>
        </div>
      )}

      {/* Metrics */}
      {metrics && (
        <div style={card}>
          <SectionLabel>Métricas</SectionLabel>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <MetricBox label="Hoje" value={String(metrics.today_runs)} unit="runs" accent="var(--accent-cyan)" />
            <MetricBox label="Total" value={String(metrics.total_runs)} unit="runs" />
            <MetricBox
              label="Aprovação"
              value={`${metrics.approval_rate}%`}
              accent={metrics.approval_rate >= 70 ? "var(--accent-green)" : "var(--accent-amber)"}
            />
            <MetricBox label="Média passos" value={String(metrics.avg_steps_per_run)} />
          </div>
        </div>
      )}

      {/* Agents quick status */}
      {squadState?.agents && (
        <div style={card}>
          <SectionLabel>Agentes</SectionLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {squadState.agents.map((a) => (
              <div
                key={a.id}
                style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}
              >
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    background: agentDot(a.status),
                    flexShrink: 0,
                    boxShadow: a.status === "working" ? `0 0 5px ${agentDot(a.status)}` : undefined,
                  }}
                />
                <span style={{ fontSize: 13 }}>{a.icon}</span>
                <span style={{ flex: 1, color: "var(--text-primary)", fontWeight: 500 }}>{a.name}</span>
                <span style={{ fontSize: 10, color: agentDot(a.status), textTransform: "uppercase", letterSpacing: 0.3 }}>
                  {agentStatusLabel(a.status)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function AgentInfoView({ details }: { details: AgentDetails }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {details.description && (
        <div style={card}>
          <SectionLabel>Sobre</SectionLabel>
          <p style={{ fontSize: 11, color: "var(--text-secondary)", lineHeight: 1.7, margin: 0 }}>
            {details.description.slice(0, 500)}
          </p>
        </div>
      )}
      <div style={card}>
        <SectionLabel>Skills & Modelo</SectionLabel>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 8 }}>
          {details.skills.map((s) => <Chip key={s}>{s}</Chip>)}
        </div>
        <Chip color="var(--accent-amber)">{details.model_tier}</Chip>
      </div>
      {details.recentActivity.length > 0 && (
        <div style={card}>
          <SectionLabel>Atividade recente</SectionLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {details.recentActivity.slice(0, 3).map((a) => (
              <div key={a.run_id} style={{ fontSize: 11, color: "var(--text-secondary)", lineHeight: 1.5 }}>
                <span style={{ color: runStatusColor(a.run_status) }}>●</span>{" "}
                {a.run_id} — {a.steps_completed.join(", ")}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function OutputsView({
  agentDetails,
  selectedSquad,
  squadState,
}: {
  agentDetails: AgentDetails | null;
  selectedSquad: string;
  squadState: unknown;
}) {
  const outputs = agentDetails?.latestOutputs ?? [];
  void squadState;
  void selectedSquad;

  if (outputs.length === 0) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: 160,
          gap: 8,
          color: "var(--text-secondary)",
        }}
      >
        <span style={{ fontSize: 28 }}>📄</span>
        <span style={{ fontSize: 12 }}>
          {agentDetails
            ? "Nenhum output gerado ainda por este agente"
            : "Selecione um agente no menu para ver seus outputs"}
        </span>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {outputs.map((o, i) => (
        <OutputCard key={i} file={o.file} content={o.content} step={o.step} />
      ))}
    </div>
  );
}

function OutputCard({ file, content, step }: { file: string; content: string; step: string }) {
  const [expanded, setExpanded] = useState(false);
  const preview = content.slice(0, 280);
  const hasMore = content.length > 280;

  return (
    <div style={{ ...card, padding: 0, overflow: "hidden" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "8px 12px",
          borderBottom: "1px solid var(--border)",
          background: "rgba(255,255,255,0.02)",
          cursor: hasMore ? "pointer" : "default",
        }}
        onClick={() => hasMore && setExpanded((e) => !e)}
      >
        <div>
          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-primary)" }}>{file}</span>
          <span style={{ fontSize: 10, color: "var(--text-secondary)", marginLeft: 6 }}>({step})</span>
        </div>
        {hasMore && (
          <span style={{ fontSize: 10, color: "var(--accent-cyan)" }}>
            {expanded ? "▲ menos" : "▼ mais"}
          </span>
        )}
      </div>
      {/* Content */}
      <pre
        style={{
          fontSize: 10.5,
          color: "var(--text-primary)",
          padding: "10px 12px",
          margin: 0,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          lineHeight: 1.6,
          maxHeight: expanded ? 600 : 180,
          overflowY: expanded ? "auto" : "hidden",
          transition: "max-height 0.2s ease",
          background: "transparent",
        }}
      >
        {expanded ? content : preview}
        {!expanded && hasMore && (
          <span style={{ color: "var(--text-secondary)" }}>{"\n"}…</span>
        )}
      </pre>
    </div>
  );
}

function RunsView({ runs }: { runs: RunItem[] }) {
  if (runs.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-secondary)", fontSize: 12 }}>
        Nenhuma run registrada
      </div>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {runs.map((run) => (
        <div key={run.run_id} style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <span style={{ fontSize: 11, color: "var(--text-secondary)", fontFamily: "monospace" }}>
              {run.run_id}
            </span>
            <StatusPill status={run.status} />
          </div>
          {run.started_at && (
            <div style={{ fontSize: 10, color: "var(--text-secondary)", marginBottom: 6 }}>
              {new Date(run.started_at).toLocaleString("pt-BR")}
            </div>
          )}
          <div style={{ height: 4, background: "var(--border)", borderRadius: 2, overflow: "hidden" }}>
            <div
              style={{
                height: "100%",
                width: `${run.steps_total > 0 ? (run.steps_done / run.steps_total) * 100 : 0}%`,
                background: runStatusColor(run.status),
                borderRadius: 2,
              }}
            />
          </div>
          <div style={{ fontSize: 10, color: "var(--text-secondary)", marginTop: 4 }}>
            {run.steps_done}/{run.steps_total} passos
          </div>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────
// Tiny shared components
// ─────────────────────────────────────────────

function StatusPill({ status }: { status: string }) {
  const color = runStatusColor(status);
  const labels: Record<string, string> = {
    working: "Ativo",
    checkpoint: "Aguarda",
    done: "Feito",
    idle: "Ocioso",
    running: "Rodando",
    completed: "Concluído",
    error: "Erro",
    saved_draft: "Rascunho",
  };
  return (
    <span
      style={{
        fontSize: 9,
        fontWeight: 700,
        padding: "2px 7px",
        borderRadius: 10,
        background: `${color}22`,
        color,
        textTransform: "uppercase",
        letterSpacing: 0.5,
        display: "inline-flex",
        alignItems: "center",
        gap: 3,
        flexShrink: 0,
      }}
    >
      <span
        style={{
          width: 4,
          height: 4,
          borderRadius: "50%",
          background: color,
          display: "inline-block",
        }}
      />
      {labels[status] ?? status}
    </span>
  );
}

function MetricBox({
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
        background: "rgba(255,255,255,0.03)",
        border: "1px solid var(--border)",
        borderRadius: 6,
        padding: "8px 10px",
      }}
    >
      <div style={{ fontSize: 10, color: "var(--text-secondary)", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: accent ?? "var(--text-primary)", lineHeight: 1 }}>
        {value}
        {unit && (
          <span style={{ fontSize: 10, fontWeight: 400, color: "var(--text-secondary)", marginLeft: 3 }}>
            {unit}
          </span>
        )}
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 9,
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: 1.2,
        color: "var(--text-secondary)",
        marginBottom: 8,
      }}
    >
      {children}
    </div>
  );
}

function Chip({
  children,
  color,
}: {
  children: React.ReactNode;
  color?: string;
}) {
  const c = color ?? "var(--accent-cyan)";
  return (
    <span
      style={{
        fontSize: 10,
        padding: "2px 8px",
        background: `${c}18`,
        border: `1px solid ${c}44`,
        borderRadius: 4,
        color: c,
        display: "inline-block",
      }}
    >
      {children}
    </span>
  );
}

function TabBtn({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        background: "none",
        border: "none",
        borderBottom: active ? "2px solid var(--accent-cyan)" : "2px solid transparent",
        color: active ? "var(--accent-cyan)" : "var(--text-secondary)",
        padding: "7px 4px",
        cursor: "pointer",
        fontSize: 11,
        fontFamily: "inherit",
        fontWeight: 600,
        transition: "all 0.15s",
        letterSpacing: 0.2,
      }}
    >
      {children}
    </button>
  );
}

function agentDot(status: string) {
  switch (status) {
    case "working": return "var(--accent-green)";
    case "checkpoint": return "var(--accent-amber)";
    case "done": return "var(--accent-cyan)";
    case "delivering": return "var(--accent-green)";
    default: return "#444458";
  }
}

function agentStatusLabel(status: string) {
  switch (status) {
    case "working": return "ativo";
    case "checkpoint": return "aguarda";
    case "done": return "feito";
    case "idle": return "ocioso";
    default: return status;
  }
}

function runStatusColor(status: string) {
  switch (status) {
    case "running":
    case "working": return "var(--accent-green)";
    case "checkpoint": return "var(--accent-amber)";
    case "completed":
    case "done":
    case "saved_draft": return "var(--accent-cyan)";
    case "error": return "var(--accent-red)";
    default: return "var(--text-secondary)";
  }
}

// ─────────────────────────────────────────────
// Styles
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

const panelHeader: React.CSSProperties = {
  padding: "10px 12px",
  borderBottom: "1px solid var(--border)",
  minHeight: 44,
  display: "flex",
  alignItems: "center",
};

const tabBar: React.CSSProperties = {
  display: "flex",
  borderBottom: "1px solid var(--border)",
  padding: "0 4px",
};

const card: React.CSSProperties = {
  background: "rgba(255,255,255,0.03)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  padding: "10px 12px",
};
