import { useState } from "react";
import { useRunStore } from "@/store/useRunStore";
import type {
  CheckpointPayload,
  CheckpointAction,
  CheckpointOption,
  Story,
  Hook,
} from "@/types/run";

// ─────────────────────────────────────────────
//  CheckpointPanel — overlay shown at each pipeline checkpoint
// ─────────────────────────────────────────────

export function CheckpointPanel() {
  const checkpoint = useRunStore((s) => s.checkpoint);
  const activeRunId = useRunStore((s) => s.activeRunId);
  const setCheckpoint = useRunStore((s) => s.setCheckpoint);

  if (!checkpoint || !activeRunId) return null;

  const submitDecision = async (
    action: string,
    value?: unknown,
    feedback?: string
  ) => {
    // Optimistically hide the panel
    setCheckpoint(null);

    await fetch(`/api/runs/${activeRunId}/checkpoint`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        step_id: checkpoint.step_id,
        action,
        value: value ?? null,
        feedback: feedback ?? null,
      }),
    }).catch(console.error);
  };

  return (
    <div style={overlayStyle}>
      <div style={panelStyle}>
        {/* Panel header */}
        <div style={headerStyle}>
          <div>
            <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 2 }}>
              {checkpoint.step_name}
            </div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{checkpoint.title}</div>
            <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4 }}>
              {checkpoint.subtitle}
            </div>
          </div>
        </div>

        {/* Scrollable body */}
        <div style={bodyStyle}>
          <CheckpointBody checkpoint={checkpoint} onDecide={submitDecision} />
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
//  Dispatch to the right checkpoint type
// ─────────────────────────────────────────────

function CheckpointBody({
  checkpoint,
  onDecide,
}: {
  checkpoint: CheckpointPayload;
  onDecide: (action: string, value?: unknown, feedback?: string) => void;
}) {
  switch (checkpoint.type) {
    case "period_selection":
      return <PeriodSelection options={checkpoint.options ?? []} onDecide={onDecide} />;
    case "story_selection":
      return <StorySelection stories={checkpoint.stories ?? []} onDecide={onDecide} />;
    case "hook_selection":
      return (
        <HookSelection
          briefMd={checkpoint.brief_md ?? ""}
          hooks={checkpoint.hooks ?? []}
          onDecide={onDecide}
        />
      );
    case "draft_review":
      return (
        <DraftReview
          draftMd={checkpoint.draft_md ?? ""}
          actions={checkpoint.actions ?? []}
          onDecide={onDecide}
        />
      );
    case "quality_decision":
      return (
        <QualityDecision
          reviewMd={checkpoint.review_md ?? ""}
          verdict={checkpoint.verdict ?? ""}
          actions={checkpoint.actions ?? []}
          onDecide={onDecide}
        />
      );
    case "design_approval":
      return (
        <DesignApproval
          slides={checkpoint.slides ?? []}
          runId={checkpoint.run_id ?? ""}
          actions={checkpoint.actions ?? []}
          onDecide={onDecide}
        />
      );
    default:
      return (
        <div style={{ padding: 16 }}>
          <ActionBar
            actions={[{ action: "approve", label: "Aprovar", style: "primary" }]}
            onDecide={onDecide}
          />
        </div>
      );
  }
}

// ─────────────────────────────────────────────
//  step-00  Período de pesquisa
// ─────────────────────────────────────────────

function PeriodSelection({
  options,
  onDecide,
}: {
  options: CheckpointOption[];
  onDecide: (action: string, value: string) => void;
}) {
  const [selected, setSelected] = useState<string | null>(options[1]?.value ?? null);

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
        {options.map((opt) => (
          <label
            key={opt.value}
            style={{
              ...optionCardStyle,
              border: selected === opt.value
                ? "1px solid #92adff"
                : "1px solid var(--border)",
              background: selected === opt.value ? "rgba(146,173,255,0.08)" : "transparent",
              cursor: "pointer",
            }}
          >
            <input
              type="radio"
              name="period"
              value={opt.value}
              checked={selected === opt.value}
              onChange={() => setSelected(opt.value)}
              style={{ accentColor: "#92adff" }}
            />
            <div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{opt.label}</div>
              {opt.description && (
                <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>
                  {opt.description}
                </div>
              )}
            </div>
          </label>
        ))}
      </div>
      <ActionBar
        actions={[{ action: "select", label: "Pesquisar notícias", style: "primary" }]}
        onDecide={(action) => onDecide(action, selected ?? options[0]?.value)}
        disabled={!selected}
      />
    </div>
  );
}

// ─────────────────────────────────────────────
//  step-02  Escolha do tema
// ─────────────────────────────────────────────

function StorySelection({
  stories,
  onDecide,
}: {
  stories: Story[];
  onDecide: (action: string, value: unknown) => void;
}) {
  const [selected, setSelected] = useState<number | null>(null);

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
        {stories.map((story, i) => (
          <div
            key={i}
            onClick={() => setSelected(i)}
            style={{
              ...optionCardStyle,
              border: selected === i ? "1px solid #92adff" : "1px solid var(--border)",
              background: selected === i ? "rgba(146,173,255,0.08)" : "transparent",
              cursor: "pointer",
              flexDirection: "column",
              alignItems: "flex-start",
              gap: 6,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", width: "100%", alignItems: "flex-start" }}>
              <div style={{ fontWeight: 600, fontSize: 13, flex: 1 }}>{story.headline}</div>
              {story.viral_potential_score !== undefined && (
                <div style={scoreBadgeStyle}>{story.viral_potential_score}/10</div>
              )}
            </div>
            {story.why_interesting && (
              <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                {story.why_interesting}
              </div>
            )}
            {story.key_data && (
              <div style={{ fontSize: 12, color: "#92adff" }}>{story.key_data}</div>
            )}
            {story.source && (
              <div style={{ fontSize: 11, color: "var(--text-secondary)", fontStyle: "italic" }}>
                {story.source} · {story.published_date}
              </div>
            )}
          </div>
        ))}
      </div>
      <ActionBar
        actions={[{ action: "select", label: "Usar este tema", style: "primary" }]}
        onDecide={(action) => selected !== null && onDecide(action, stories[selected])}
        disabled={selected === null}
      />
    </div>
  );
}

// ─────────────────────────────────────────────
//  step-04  Aprovação do brief + hook
// ─────────────────────────────────────────────

function HookSelection({
  briefMd,
  hooks,
  onDecide,
}: {
  briefMd: string;
  hooks: Hook[];
  onDecide: (action: string, value: unknown) => void;
}) {
  const [selectedHook, setSelectedHook] = useState<string | null>(null);
  const [showBrief, setShowBrief] = useState(false);

  return (
    <div style={{ padding: 20 }}>
      {/* Brief toggle */}
      {briefMd && (
        <div style={{ marginBottom: 16 }}>
          <button onClick={() => setShowBrief((v) => !v)} style={ghostBtnStyle}>
            {showBrief ? "▲ Fechar brief" : "▼ Ver brief completo"}
          </button>
          {showBrief && (
            <pre style={mdPreStyle}>{briefMd}</pre>
          )}
        </div>
      )}

      {/* Hooks */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
        {hooks.map((hook) => (
          <div
            key={hook.letter}
            onClick={() => setSelectedHook(hook.letter)}
            style={{
              ...optionCardStyle,
              flexDirection: "column",
              alignItems: "flex-start",
              gap: 8,
              border: selectedHook === hook.letter ? "1px solid #92adff" : "1px solid var(--border)",
              background: selectedHook === hook.letter ? "rgba(146,173,255,0.08)" : "transparent",
              cursor: "pointer",
            }}
          >
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span style={hookLetterStyle}>{hook.letter}</span>
              <span style={{ fontSize: 11, color: "#92adff", textTransform: "uppercase" }}>
                Driver: {hook.driver}
              </span>
            </div>
            <div style={{ fontWeight: 600, fontSize: 14, lineHeight: 1.4 }}>{hook.text}</div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", fontStyle: "italic" }}>
              {hook.rationale}
            </div>
          </div>
        ))}
      </div>

      <ActionBar
        actions={[{ action: "select", label: "Usar este hook", style: "primary" }]}
        onDecide={(action) => selectedHook && onDecide(action, { hook: selectedHook })}
        disabled={!selectedHook}
      />
    </div>
  );
}

// ─────────────────────────────────────────────
//  step-06  Revisão do rascunho
// ─────────────────────────────────────────────

function DraftReview({
  draftMd,
  actions,
  onDecide,
}: {
  draftMd: string;
  actions: CheckpointAction[];
  onDecide: (action: string, value?: unknown, feedback?: string) => void;
}) {
  const [feedback, setFeedback] = useState("");
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  const hasFeedbackAction = actions.find((a) => a.has_feedback);

  const handleAction = (action: CheckpointAction) => {
    if (action.has_feedback) {
      setPendingAction(action.action);
    } else {
      onDecide(action.action);
    }
  };

  if (pendingAction) {
    return (
      <div style={{ padding: 20 }}>
        <div style={{ marginBottom: 8, fontWeight: 600 }}>Quais ajustes você quer?</div>
        <textarea
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          placeholder="Descreva os ajustes necessários…"
          rows={5}
          style={textareaStyle}
        />
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button
            onClick={() => onDecide(pendingAction, null, feedback)}
            disabled={!feedback.trim()}
            style={actionBtnStyle("primary", !feedback.trim())}
          >
            Enviar feedback
          </button>
          <button onClick={() => setPendingAction(null)} style={actionBtnStyle("ghost", false)}>
            Voltar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 20 }}>
      <pre style={mdPreStyle}>{draftMd}</pre>
      <div style={{ marginTop: 16 }}>
        <ActionBar actions={actions} onDecide={(a) => handleAction(actions.find((x) => x.action === a)!)} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
//  step-08  Veredicto de qualidade
// ─────────────────────────────────────────────

function QualityDecision({
  reviewMd,
  verdict,
  actions,
  onDecide,
}: {
  reviewMd: string;
  verdict: string;
  actions: CheckpointAction[];
  onDecide: (action: string) => void;
}) {
  const [showReview, setShowReview] = useState(false);

  return (
    <div style={{ padding: 20 }}>
      {verdict && (
        <div style={{ marginBottom: 16, padding: "10px 14px", background: "rgba(146,173,255,0.1)", borderRadius: 8, fontSize: 14, fontWeight: 600 }}>
          {verdict}
        </div>
      )}

      <button onClick={() => setShowReview((v) => !v)} style={{ ...ghostBtnStyle, marginBottom: 16 }}>
        {showReview ? "▲ Fechar revisão" : "▼ Ver revisão completa"}
      </button>
      {showReview && <pre style={mdPreStyle}>{reviewMd}</pre>}

      <ActionBar actions={actions} onDecide={onDecide} />
    </div>
  );
}

// ─────────────────────────────────────────────
//  step-10  Aprovação para publicação
// ─────────────────────────────────────────────

function DesignApproval({
  slides,
  runId,
  actions,
  onDecide,
}: {
  slides: string[];
  runId: string;
  actions: CheckpointAction[];
  onDecide: (action: string) => void;
}) {
  return (
    <div style={{ padding: 20 }}>
      {/* Image previews */}
      {slides.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
          {slides.map((slide) => (
            <img
              key={slide}
              src={`/api/runs/${runId}/artifacts/design/${slide}`}
              alt={slide}
              style={{ width: "100%", borderRadius: 8, border: "1px solid var(--border)" }}
            />
          ))}
        </div>
      ) : (
        <div style={{ marginBottom: 20, color: "var(--text-secondary)", fontSize: 13 }}>
          Nenhum arquivo de design encontrado.
        </div>
      )}
      <ActionBar actions={actions} onDecide={onDecide} />
    </div>
  );
}

// ─────────────────────────────────────────────
//  Shared: ActionBar
// ─────────────────────────────────────────────

function ActionBar({
  actions,
  onDecide,
  disabled = false,
}: {
  actions: CheckpointAction[];
  onDecide: (action: string) => void;
  disabled?: boolean;
}) {
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {actions.map((a) => (
        <button
          key={a.action}
          onClick={() => !disabled && onDecide(a.action)}
          disabled={disabled && a.style === "primary"}
          style={actionBtnStyle(a.style, disabled && a.style === "primary")}
        >
          {a.label}
        </button>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────
//  Styles
// ─────────────────────────────────────────────

const overlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.6)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 100,
  backdropFilter: "blur(2px)",
};

const panelStyle: React.CSSProperties = {
  width: "min(640px, 95vw)",
  maxHeight: "90vh",
  background: "var(--bg-sidebar)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
  boxShadow: "0 24px 48px rgba(0,0,0,0.5)",
};

const headerStyle: React.CSSProperties = {
  padding: "20px 24px 16px",
  borderBottom: "1px solid var(--border)",
};

const bodyStyle: React.CSSProperties = {
  overflowY: "auto",
  flex: 1,
};

const optionCardStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: "12px 14px",
  borderRadius: 8,
  transition: "border-color 0.15s, background 0.15s",
};

const scoreBadgeStyle: React.CSSProperties = {
  background: "rgba(146,173,255,0.15)",
  color: "#92adff",
  fontWeight: 700,
  fontSize: 12,
  padding: "2px 8px",
  borderRadius: 20,
  whiteSpace: "nowrap",
  flexShrink: 0,
  marginLeft: 8,
};

const hookLetterStyle: React.CSSProperties = {
  width: 28,
  height: 28,
  background: "#92adff",
  color: "#0d0d0f",
  borderRadius: 6,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: 800,
  fontSize: 14,
  flexShrink: 0,
};

const mdPreStyle: React.CSSProperties = {
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
  fontSize: 12,
  lineHeight: 1.7,
  color: "var(--text-secondary)",
  background: "rgba(0,0,0,0.2)",
  padding: "12px 14px",
  borderRadius: 8,
  border: "1px solid var(--border)",
  maxHeight: 320,
  overflowY: "auto",
};

const textareaStyle: React.CSSProperties = {
  width: "100%",
  background: "rgba(0,0,0,0.2)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  color: "var(--text-primary)",
  fontSize: 13,
  padding: "10px 12px",
  resize: "vertical",
  fontFamily: "inherit",
  boxSizing: "border-box",
};

const ghostBtnStyle: React.CSSProperties = {
  background: "transparent",
  border: "1px solid var(--border)",
  color: "var(--text-secondary)",
  borderRadius: 6,
  fontSize: 12,
  padding: "5px 10px",
  cursor: "pointer",
};

function actionBtnStyle(
  style: CheckpointAction["style"],
  disabled: boolean
): React.CSSProperties {
  const base: React.CSSProperties = {
    padding: "9px 18px",
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 600,
    border: "none",
    cursor: disabled ? "not-allowed" : "pointer",
    transition: "opacity 0.15s",
    opacity: disabled ? 0.45 : 1,
  };
  switch (style) {
    case "primary":
      return { ...base, background: "#92adff", color: "#0d0d0f" };
    case "secondary":
      return { ...base, background: "rgba(146,173,255,0.12)", color: "#92adff", border: "1px solid rgba(146,173,255,0.3)" };
    case "danger":
      return { ...base, background: "rgba(255,80,80,0.1)", color: "#ff5050", border: "1px solid rgba(255,80,80,0.3)" };
    case "ghost":
      return { ...base, background: "transparent", color: "var(--text-secondary)", border: "1px solid var(--border)" };
  }
}
