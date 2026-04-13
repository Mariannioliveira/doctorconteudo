import { useEffect, useState } from "react";
import { useSquadStore } from "@/store/useSquadStore";

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

export function AgentPanel() {
  const selectedSquad = useSquadStore((s) => s.selectedSquad);
  const selectedAgent = useSquadStore((s) => s.selectedAgent);
  const selectAgent = useSquadStore((s) => s.selectAgent);
  const state = useSquadStore((s) =>
    s.selectedSquad ? s.activeStates.get(s.selectedSquad) : undefined
  );
  const [details, setDetails] = useState<AgentDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"info" | "output" | "logs">("info");

  useEffect(() => {
    if (!selectedSquad || !selectedAgent) { setDetails(null); return; }
    setLoading(true);
    fetch(`/api/squads/${selectedSquad}/agents/${selectedAgent}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { setDetails(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [selectedSquad, selectedAgent, state?.status]);

  if (!selectedAgent) return null;

  // Get live status from websocket state
  const liveAgent = state?.agents?.find((a) => a.id === selectedAgent);
  const liveStatus = liveAgent?.status ?? details?.status ?? "idle";

  return (
    <div style={overlayStyle} onClick={() => selectAgent(null)}>
      <div style={panelStyle} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={headerStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 28 }}>{details?.icon ?? "🤖"}</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: "var(--text-primary)" }}>
                {details?.name ?? selectedAgent}
              </div>
              {details?.role && (
                <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 1 }}>
                  {details.role}
                </div>
              )}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <StatusPill status={liveStatus} />
            <button
              onClick={() => selectAgent(null)}
              style={closeBtnStyle}
              title="Fechar"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div style={tabBarStyle}>
          {(["info", "output", "logs"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                ...tabBtnStyle,
                borderBottom: activeTab === tab ? "2px solid var(--accent-cyan)" : "2px solid transparent",
                color: activeTab === tab ? "var(--accent-cyan)" : "var(--text-secondary)",
              }}
            >
              {tab === "info" ? "Info" : tab === "output" ? "Outputs" : "Atividade"}
            </button>
          ))}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px" }}>
          {loading && (
            <div style={{ color: "var(--text-secondary)", fontSize: 12 }}>Carregando...</div>
          )}

          {!loading && details && activeTab === "info" && (
            <InfoTab details={details} />
          )}

          {!loading && details && activeTab === "output" && (
            <OutputTab outputs={details.latestOutputs} />
          )}

          {!loading && details && activeTab === "logs" && (
            <ActivityTab activity={details.recentActivity} />
          )}
        </div>
      </div>
    </div>
  );
}

function InfoTab({ details }: { details: AgentDetails }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {details.description && (
        <div>
          <SectionLabel>Descrição</SectionLabel>
          <p style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.6, margin: 0 }}>
            {details.description.slice(0, 400)}
          </p>
        </div>
      )}

      <div>
        <SectionLabel>Skills</SectionLabel>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {details.skills.length > 0
            ? details.skills.map((s) => <Tag key={s}>{s}</Tag>)
            : <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>—</span>}
        </div>
      </div>

      <div>
        <SectionLabel>Modelo</SectionLabel>
        <Tag>{details.model_tier}</Tag>
      </div>
    </div>
  );
}

function OutputTab({ outputs }: { outputs: AgentDetails["latestOutputs"] }) {
  if (outputs.length === 0) {
    return (
      <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
        Nenhum output disponível ainda.
      </div>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {outputs.map((o, i) => (
        <div key={i}>
          <SectionLabel>{o.file} <span style={{ fontWeight: 400 }}>({o.step})</span></SectionLabel>
          <pre
            style={{
              fontSize: 11,
              color: "var(--text-primary)",
              background: "rgba(255,255,255,0.03)",
              border: "1px solid var(--border)",
              borderRadius: 6,
              padding: "10px 12px",
              margin: 0,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              maxHeight: 220,
              overflowY: "auto",
              lineHeight: 1.5,
            }}
          >
            {o.content}
          </pre>
        </div>
      ))}
    </div>
  );
}

function ActivityTab({ activity }: { activity: AgentDetails["recentActivity"] }) {
  if (activity.length === 0) {
    return (
      <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
        Sem atividade registrada.
      </div>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {activity.map((a) => (
        <div
          key={a.run_id}
          style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid var(--border)",
            borderRadius: 6,
            padding: "10px 12px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>
              {a.run_id}
            </span>
            <StatusPill status={a.run_status} />
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {a.steps_completed.map((step, i) => (
              <Tag key={i}>{step}</Tag>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 10,
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: 1,
        color: "var(--text-secondary)",
        marginBottom: 6,
      }}
    >
      {children}
    </div>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        fontSize: 11,
        padding: "2px 8px",
        background: "rgba(0, 212, 255, 0.1)",
        border: "1px solid rgba(0, 212, 255, 0.2)",
        borderRadius: 4,
        color: "var(--accent-cyan)",
      }}
    >
      {children}
    </span>
  );
}

function StatusPill({ status }: { status: string }) {
  const color = {
    working: "var(--accent-green)",
    checkpoint: "var(--accent-amber)",
    done: "var(--accent-cyan)",
    delivering: "var(--accent-green)",
    completed: "var(--accent-cyan)",
    running: "var(--accent-green)",
    error: "var(--accent-red)",
  }[status] ?? "var(--text-secondary)";

  const label = {
    working: "Trabalhando",
    checkpoint: "Aguardando",
    done: "Feito",
    delivering: "Enviando",
    idle: "Ocioso",
    completed: "Concluído",
    running: "Rodando",
    error: "Erro",
  }[status] ?? status;

  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 600,
        padding: "2px 8px",
        borderRadius: 10,
        background: `${color}22`,
        color,
        textTransform: "uppercase",
        letterSpacing: 0.5,
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
      }}
    >
      <span
        style={{
          width: 5,
          height: 5,
          borderRadius: "50%",
          background: color,
          display: "inline-block",
          boxShadow: status === "working" || status === "running" ? `0 0 4px ${color}` : undefined,
        }}
      />
      {label}
    </span>
  );
}

const overlayStyle: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  background: "rgba(0,0,0,0.5)",
  zIndex: 100,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const panelStyle: React.CSSProperties = {
  width: 480,
  maxWidth: "90vw",
  maxHeight: "80vh",
  background: "var(--bg-sidebar)",
  border: "1px solid var(--border)",
  borderRadius: 10,
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
  boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "14px 16px",
  borderBottom: "1px solid var(--border)",
};

const tabBarStyle: React.CSSProperties = {
  display: "flex",
  borderBottom: "1px solid var(--border)",
  padding: "0 16px",
};

const tabBtnStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  borderBottom: "2px solid transparent",
  padding: "8px 14px",
  cursor: "pointer",
  fontSize: 12,
  fontFamily: "inherit",
  fontWeight: 600,
  letterSpacing: 0.3,
  transition: "all 0.15s",
};

const closeBtnStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  color: "var(--text-secondary)",
  cursor: "pointer",
  fontSize: 14,
  padding: "4px 6px",
  borderRadius: 4,
  fontFamily: "inherit",
};
