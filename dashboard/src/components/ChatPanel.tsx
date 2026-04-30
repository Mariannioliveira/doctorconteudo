import { useEffect, useRef, useState } from "react";
import { useSquadStore } from "@/store/useSquadStore";
import { useSquadStream } from "@/hooks/useSquadStream";
import type { ChatMessage, CheckpointPayload, CheckpointStory } from "@/types/chat";

// Stable references to avoid Zustand infinite loops with ?? []
const EMPTY_MESSAGES: ChatMessage[] = [];
const EMPTY_MAP = new Map<string, string>();

// ─────────────────────────────────────────────
// Main Chat Panel
// ─────────────────────────────────────────────

export function ChatPanel() {
  const selectedSquad = useSquadStore((s) => s.selectedSquad);
  const squadInfo = useSquadStore((s) =>
    s.selectedSquad ? s.squads.get(s.selectedSquad) : undefined
  );
  const activeState = useSquadStore((s) =>
    s.selectedSquad ? s.activeStates.get(s.selectedSquad) : undefined
  );
  const messages = useSquadStore((s) =>
    s.selectedSquad ? (s.chatMessages.get(s.selectedSquad) ?? EMPTY_MESSAGES) : EMPTY_MESSAGES
  );
  const tokenBuffer = useSquadStore((s) =>
    s.selectedSquad ? s.tokenBuffer : EMPTY_MAP
  );
  const startSquad = useSquadStore((s) => s.startSquad);
  const stopSquad = useSquadStore((s) => s.stopSquad);
  const addMessage = useSquadStore((s) => s.addMessage);
  const submitCheckpoint = useSquadStore((s) => s.submitCheckpoint);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const checkpointRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Connect SSE stream
  useSquadStream(selectedSquad);

  // When a pending checkpoint is the last message, scroll to its top so the user sees
  // the full story/option list from the beginning. For all other messages, scroll to bottom.
  useEffect(() => {
    const last = messages[messages.length - 1];
    if (last?.type === "checkpoint" && !(last as Extract<typeof last, { type: "checkpoint" }>).resolved) {
      checkpointRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [messages.length]);

  const isRunning = activeState?.status === "running" || activeState?.status === "checkpoint";
  const hasCheckpointPending = messages.some(
    (m) => m.type === "checkpoint" && !m.resolved
  );

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

  const handleSend = async () => {
    if (!input.trim() || !selectedSquad) return;
    const text = input.trim();
    setInput("");

    // If there's a pending checkpoint, treat the message as feedback
    const pendingCheckpoint = [...messages].reverse().find(
      (m) => m.type === "checkpoint" && !m.resolved
    );
    if (pendingCheckpoint && pendingCheckpoint.type === "checkpoint") {
      addMessage(selectedSquad, {
        id: `human-${Date.now()}`,
        type: "human",
        content: text,
        timestamp: new Date().toISOString(),
      });
      await submitCheckpoint(selectedSquad, pendingCheckpoint.stepId, "request_changes", null, text);
    } else {
      // No active checkpoint — just show locally as a note
      addMessage(selectedSquad, {
        id: `human-${Date.now()}`,
        type: "human",
        content: text,
        timestamp: new Date().toISOString(),
      });
      addMessage(selectedSquad, {
        id: `sys-${Date.now()}`,
        type: "system",
        content: "Mensagem registrada. Use os botões de checkpoint para interagir com o pipeline.",
        variant: "info",
        timestamp: new Date().toISOString(),
      });
    }

    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!selectedSquad) {
    return (
      <div style={emptyStyle}>
        <span style={{ fontSize: 48 }}>🏢</span>
        <span style={{ fontSize: 16, color: "var(--text-primary)", fontWeight: 600 }}>
          Selecione um squad
        </span>
        <span style={{ fontSize: 13, color: "var(--text-secondary)", maxWidth: 300, textAlign: "center", lineHeight: 1.6 }}>
          Escolha um squad na sidebar para iniciar a produção de conteúdo
        </span>
      </div>
    );
  }

  return (
    <div style={panelStyle}>
      {/* Chat header */}
      <div style={chatHeaderStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: 22 }}>{squadInfo?.icon ?? "🤖"}</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text-primary)" }}>
              {squadInfo?.name ?? selectedSquad}
            </div>
            <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>
              {activeState
                ? `${activeState.step.current}/${activeState.step.total} — ${activeState.step.label}`
                : "Inativo"}
            </div>
          </div>
          {activeState && <StatusBadge status={activeState.status} />}
        </div>

        {/* Controls */}
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          {!isRunning ? (
            <ActionBtn color="#22c55e" onClick={handleStart} disabled={loading}>
              ▶ Ativar Squad
            </ActionBtn>
          ) : (
            <ActionBtn color="#ef4444" onClick={handleStop} disabled={loading}>
              ⏹ Parar
            </ActionBtn>
          )}
        </div>
      </div>

      {/* Progress bar */}
      {activeState && (
        <div style={{ height: 2, background: "var(--border)" }}>
          <div
            style={{
              height: "100%",
              width: `${activeState.step.total > 0 ? (activeState.step.current / activeState.step.total) * 100 : 0}%`,
              background: isRunning ? "var(--accent-green)" : "var(--accent-cyan)",
              transition: "width 0.5s ease",
            }}
          />
        </div>
      )}

      {/* Messages */}
      <div style={messagesStyle}>
        {messages.length === 0 && (
          <div style={{ textAlign: "center", padding: "60px 20px" }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>💬</div>
            <div style={{ fontSize: 14, color: "var(--text-primary)", fontWeight: 600, marginBottom: 6 }}>
              Pronto para trabalhar
            </div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.7 }}>
              Clique em <strong style={{ color: "var(--accent-green)" }}>▶ Ativar Squad</strong> para iniciar
              o pipeline de conteúdo.<br />
              Os agentes vão aparecer aqui conforme trabalham.
            </div>
          </div>
        )}

        {messages.map((msg, i) => {
          const isLastCheckpoint =
            msg.type === "checkpoint" && !msg.resolved && i === messages.length - 1;
          return (
            <MessageItem
              key={msg.id}
              msg={msg}
              squad={selectedSquad}
              tokenBuffer={tokenBuffer}
              isLast={i === messages.length - 1}
              checkpointRef={isLastCheckpoint ? checkpointRef : undefined}
            />
          );
        })}

        {/* Reuse stories panel — visible when run is concluded */}
        {!isRunning && messages.length > 0 && (
          <ReuseStoriesPanel squad={selectedSquad} messages={messages} onRerun={handleStart} />
        )}

        {/* Live token stream indicator */}
        {isRunning && !hasCheckpointPending && activeState?.agents?.find((a) => a.status === "working") && (
          <TypingIndicator agents={activeState.agents.filter((a) => a.status === "working")} />
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={inputAreaStyle}>
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            hasCheckpointPending
              ? "Responda ao checkpoint acima ou use os botões de aprovação..."
              : "Envie uma mensagem para o squad... (Enter para enviar)"
          }
          rows={2}
          style={textareaStyle}
        />
        <button
          onClick={handleSend}
          disabled={!input.trim()}
          style={sendBtnStyle(!!input.trim())}
        >
          ↑
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Reuse stories panel (after run concludes)
// ─────────────────────────────────────────────

function ReuseStoriesPanel({
  squad,
  messages,
  onRerun,
}: {
  squad: string;
  messages: ChatMessage[];
  onRerun: () => void;
}) {
  const [stories, setStories] = useState<CheckpointStory[]>([]);
  const [runId, setRunId] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [selectedStory, setSelectedStory] = useState<CheckpointStory | null>(null);
  const [open, setOpen] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [loading, setLoading] = useState(false);

  // Resolve runId: first try messages, then fall back to the most recent backend run
  useEffect(() => {
    // Try to find "Pipeline iniciado — run-XXXX" in chat messages
    for (const m of messages) {
      if (m.type === "system") {
        const match = m.content.match(/run-[\d-]+/);
        if (match) { setRunId(match[0]); return; }
      }
    }
    // Fallback: ask backend for the most recent run
    fetch(`/api/squads/${squad}/runs`)
      .then((r) => r.ok ? r.json() : null)
      .then((runs: { run_id: string }[] | null) => {
        if (runs && runs.length > 0) setRunId(runs[0].run_id);
      })
      .catch(() => null);
  }, [squad, messages]);

  // Fetch stories when panel opens
  useEffect(() => {
    if (!open || !runId || stories.length > 0) return;
    setFetching(true);
    fetch(`/api/squads/${squad}/runs/${runId}/stories`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d?.stories?.length) setStories(d.stories); })
      .catch(() => null)
      .finally(() => setFetching(false));
  }, [open, runId, squad, stories.length]);

  const handleRerun = async () => {
    if (!selectedStory || !runId) return;
    setLoading(true);
    try {
      await fetch(`/api/squads/${squad}/rerun`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source_run_id: runId, selected_story: selectedStory }),
      });
      setOpen(false);
      onRerun();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ margin: "12px 16px", borderRadius: 12, border: "1px solid rgba(0,212,255,0.25)", background: "rgba(0,212,255,0.04)", overflow: "hidden" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{ width: "100%", padding: "10px 14px", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 8, fontFamily: "inherit", color: "var(--accent-cyan)", fontSize: 12, fontWeight: 700, textAlign: "left" }}
      >
        <span>🔄</span>
        <span>Usar outra notícia desta pesquisa</span>
        <span style={{ marginLeft: "auto", fontSize: 10 }}>{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div style={{ borderTop: "1px solid rgba(0,212,255,0.15)", padding: "12px 14px" }}>
          {fetching || (stories.length === 0 && runId) ? (
            <div style={{ fontSize: 12, color: "var(--text-secondary)", padding: "8px 0" }}>
              Carregando notícias...
            </div>
          ) : stories.length === 0 ? (
            <div style={{ fontSize: 12, color: "var(--text-secondary)", padding: "8px 0" }}>
              Nenhuma notícia encontrada. Inicie um novo run para buscar.
            </div>
          ) : (
            <>
              <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 8 }}>
                Escolha uma notícia — Carlos Cópia reescreve sem refazer a busca. Verifique o link antes de usar:
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {stories.map((story, i) => (
                  <StoryCard
                    key={i}
                    story={story}
                    index={i}
                    selected={selected === String(i)}
                    onClick={() => { setSelected(String(i)); setSelectedStory(story); }}
                  />
                ))}
              </div>
              <button
                style={{ ...checkpointBtnStyle("primary"), marginTop: 12, opacity: (!selected || loading) ? 0.5 : 1 }}
                disabled={!selected || loading}
                onClick={handleRerun}
              >
                {loading ? "Iniciando..." : "Reescrever copy com esta notícia"}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}


// ─────────────────────────────────────────────
// Message renderer
// ─────────────────────────────────────────────

function MessageItem({
  msg,
  squad,
  tokenBuffer,
  isLast,
  checkpointRef,
}: {
  msg: ChatMessage;
  squad: string;
  tokenBuffer: Map<string, string>;
  isLast: boolean;
  checkpointRef?: React.RefObject<HTMLDivElement | null>;
}) {
  switch (msg.type) {
    case "system":
      return <SystemMessage msg={msg} />;
    case "human":
      return <HumanMessage msg={msg} />;
    case "agent_start":
      return <AgentStartMessage msg={msg} tokenBuffer={tokenBuffer} squad={squad} isLast={isLast} />;
    case "agent_output":
      return <AgentOutputMessage msg={msg} squad={squad} />;
    case "checkpoint":
      return <CheckpointMessage msg={msg} squad={squad} containerRef={checkpointRef} />;
    default:
      return null;
  }
}

function SystemMessage({ msg }: { msg: Extract<ChatMessage, { type: "system" }> }) {
  const colors = {
    info: { bg: "rgba(0,212,255,0.08)", border: "rgba(0,212,255,0.2)", icon: "ℹ️" },
    success: { bg: "rgba(34,197,94,0.08)", border: "rgba(34,197,94,0.2)", icon: "✅" },
    warning: { bg: "rgba(251,191,36,0.08)", border: "rgba(251,191,36,0.2)", icon: "⚠️" },
    error: { bg: "rgba(239,68,68,0.08)", border: "rgba(239,68,68,0.2)", icon: "❌" },
  }[msg.variant];

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 14px",
        margin: "4px 16px",
        background: colors.bg,
        border: `1px solid ${colors.border}`,
        borderRadius: 8,
        fontSize: 12,
        color: "var(--text-secondary)",
      }}
    >
      <span>{colors.icon}</span>
      <span>{msg.content}</span>
    </div>
  );
}

function HumanMessage({ msg }: { msg: Extract<ChatMessage, { type: "human" }> }) {
  return (
    <div style={{ display: "flex", justifyContent: "flex-end", padding: "6px 16px" }}>
      <div
        style={{
          maxWidth: "70%",
          background: "rgba(0,212,255,0.15)",
          border: "1px solid rgba(0,212,255,0.25)",
          borderRadius: "16px 16px 4px 16px",
          padding: "10px 14px",
          fontSize: 13,
          color: "var(--text-primary)",
          lineHeight: 1.5,
        }}
      >
        {msg.content}
      </div>
    </div>
  );
}

function AgentStartMessage({
  msg,
  tokenBuffer,
  squad,
  isLast,
}: {
  msg: Extract<ChatMessage, { type: "agent_start" }>;
  tokenBuffer: Map<string, string>;
  squad: string;
  isLast: boolean;
}) {
  const liveTokens = isLast ? (tokenBuffer.get(`${squad}:${msg.agent.id}`) ?? "") : "";
  const hasTokens = liveTokens.length > 0;

  return (
    <div style={agentBubbleStyle}>
      <AgentAvatar agent={msg.agent} working={hasTokens} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={agentHeaderStyle}>
          <span style={{ fontWeight: 700, fontSize: 13, color: "var(--text-primary)" }}>
            {msg.agent.name}
          </span>
          <span style={{ fontSize: 10, color: "var(--text-secondary)", marginLeft: 6 }}>
            {msg.stepName}
          </span>
          {hasTokens && <PulsingDot />}
        </div>
        {hasTokens && (
          <div
            style={{
              fontSize: 12,
              color: "var(--text-secondary)",
              lineHeight: 1.7,
              marginTop: 4,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            {liveTokens}
            <span style={{ display: "inline-block", width: 2, height: 14, background: "var(--accent-cyan)", verticalAlign: "middle", animation: "pulse 1s infinite", marginLeft: 2 }} />
          </div>
        )}
        {!hasTokens && (
          <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>
            Iniciando {msg.stepName}...
          </div>
        )}
      </div>
    </div>
  );
}

function AgentOutputMessage({
  msg,
  squad,
}: {
  msg: Extract<ChatMessage, { type: "agent_output" }>;
  squad: string;
}) {
  const [output, setOutput] = useState<{ file: string; content: string; step: string }[]>(msg.outputs ?? []);

  useEffect(() => {
    // Use outputs embedded in SSE event when available (avoids race condition on first load)
    if (msg.outputs && msg.outputs.length > 0) {
      setOutput(msg.outputs);
      return;
    }
    // Fallback fetch for reconnect scenarios where outputs weren't embedded
    fetch(`/api/squads/${squad}/agents/${msg.agent.id}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => d?.latestOutputs && setOutput(d.latestOutputs))
      .catch(() => null);
  }, [squad, msg.agent.id, msg.stepId]);

  return (
    <div style={agentBubbleStyle}>
      <AgentAvatar agent={msg.agent} working={false} done />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={agentHeaderStyle}>
          <span style={{ fontWeight: 700, fontSize: 13, color: "var(--text-primary)" }}>
            {msg.agent.name}
          </span>
          <span style={{ fontSize: 11, color: "var(--accent-green)", marginLeft: 6 }}>
            ✓ {msg.stepName} concluído
          </span>
        </div>
        {output.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
            {output.map((o, i) => <OutputCard key={i} file={o.file} content={o.content} step={o.step} />)}
          </div>
        )}
      </div>
    </div>
  );
}

function CheckpointMessage({
  msg,
  squad,
  containerRef,
}: {
  msg: Extract<ChatMessage, { type: "checkpoint" }>;
  squad: string;
  containerRef?: React.RefObject<HTMLDivElement | null>;
}) {
  const submitCheckpoint = useSquadStore((s) => s.submitCheckpoint);
  const [feedback, setFeedback] = useState("");
  const [showFeedback, setShowFeedback] = useState(false);
  const [showStorySelector, setShowStorySelector] = useState(false);
  // selected: string key (index or hook letter)
  // selectedValue: the actual payload to send to backend
  const [selected, setSelected] = useState<string | null>(null);
  const [selectedValue, setSelectedValue] = useState<unknown>(null);

  const payload = msg.payload;

  const handleSelect = (key: string, value: unknown) => {
    setSelected(key);
    setSelectedValue(value);
  };

  const handleAction = async (action: string, hasFeedback?: boolean) => {
    if (hasFeedback) {
      setShowFeedback(true);
      return;
    }
    // Show story selector inline for rewrite_copy
    if (action === "rewrite_copy") {
      setShowStorySelector(true);
      return;
    }
    // Browser download for design_approval — trigger file download then end pipeline
    if (action === "download" && payload.type === "design_approval" && payload.run_id) {
      const link = document.createElement("a");
      link.href = `/api/squads/${squad}/runs/${payload.run_id}/card/download`;
      link.download = "doctorcreator-card.jpg";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
    await submitCheckpoint(squad, msg.stepId, action, selectedValue ?? selected, undefined);
  };

  const handleSubmitFeedback = async (action: string) => {
    await submitCheckpoint(squad, msg.stepId, action, selectedValue ?? selected, feedback);
    setShowFeedback(false);
  };

  return (
    <div
      ref={containerRef}
      style={{
        margin: "8px 16px",
        borderRadius: 12,
        border: msg.resolved
          ? "1px solid rgba(34,197,94,0.25)"
          : "1px solid rgba(251,191,36,0.4)",
        background: msg.resolved
          ? "rgba(34,197,94,0.05)"
          : "rgba(251,191,36,0.06)",
      }}
    >
      {/* Checkpoint header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "12px 16px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          background: msg.resolved
            ? "rgba(34,197,94,0.08)"
            : "rgba(251,191,36,0.1)",
        }}
      >
        <span style={{ fontSize: 18 }}>{msg.resolved ? "✅" : "⏸️"}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: "var(--text-primary)" }}>
            {payload.title}
          </div>
          {payload.subtitle && (
            <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 1 }}>
              {payload.subtitle}
            </div>
          )}
        </div>
        {msg.resolved && (
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              padding: "3px 10px",
              borderRadius: 10,
              background: "rgba(34,197,94,0.15)",
              color: "#22c55e",
              textTransform: "uppercase",
              letterSpacing: 0.5,
            }}
          >
            {msg.resolution?.action}
          </span>
        )}
      </div>

      {/* Checkpoint content */}
      {!msg.resolved && (
        <div style={{ display: "flex", flexDirection: "column" }}>
          {/* Scrollable body */}
          <div style={{ padding: "12px 16px" }}>
            {showStorySelector && payload.stories && payload.stories.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 4 }}>
                  Escolha outra notícia para reescrever o copy:
                </div>
                {payload.stories.map((story, i) => (
                  <StoryCard
                    key={i}
                    story={story}
                    index={i}
                    selected={selected === String(i)}
                    onClick={() => handleSelect(String(i), story)}
                  />
                ))}
              </div>
            ) : (
              <CheckpointBody
                payload={payload}
                selected={selected}
                onSelect={handleSelect}
              />
            )}

            {/* Feedback input */}
            {showFeedback && (
              <div style={{ marginTop: 10 }}>
                <textarea
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="Descreva os ajustes necessários..."
                  rows={3}
                  style={{
                    ...textareaStyle,
                    width: "100%",
                    fontSize: 12,
                    marginBottom: 8,
                  }}
                  autoFocus
                />
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div
            style={{
              padding: "10px 16px",
              borderTop: "1px solid rgba(255,255,255,0.06)",
              background: "rgba(0,0,0,0.15)",
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
            }}
          >
            {showStorySelector ? (
              <>
                <button
                  style={checkpointBtnStyle("primary")}
                  onClick={() => submitCheckpoint(squad, msg.stepId, "rewrite_copy", selectedValue ?? selected, undefined)}
                  disabled={!selected}
                >
                  Reescrever com esta notícia
                </button>
                <button
                  style={checkpointBtnStyle("ghost")}
                  onClick={() => { setShowStorySelector(false); setSelected(null); setSelectedValue(null); }}
                >
                  Cancelar
                </button>
              </>
            ) : showFeedback ? (
              <>
                <button
                  style={checkpointBtnStyle("primary")}
                  onClick={() => handleSubmitFeedback("request_changes")}
                >
                  Enviar feedback
                </button>
                <button
                  style={checkpointBtnStyle("ghost")}
                  onClick={() => setShowFeedback(false)}
                >
                  Cancelar
                </button>
              </>
            ) : payload.actions ? (
              payload.actions.map((action) => (
                <button
                  key={action.action}
                  style={checkpointBtnStyle(action.style)}
                  onClick={() => handleAction(action.action, action.has_feedback)}
                  disabled={action.action === "select" && !selected}
                >
                  {action.label}
                </button>
              ))
            ) : (payload.options || payload.stories) ? (
              <button
                style={checkpointBtnStyle("primary")}
                onClick={() => handleAction("select")}
                disabled={!selected}
              >
                Confirmar seleção
              </button>
            ) : null}
          </div>
        </div>
      )}

      {/* Resolved summary */}
      {msg.resolved && msg.resolution && (
        <div style={{ padding: "8px 16px", fontSize: 11, color: "var(--text-secondary)" }}>
          Ação: <strong style={{ color: "var(--text-primary)" }}>{msg.resolution.action}</strong>
          {msg.resolution.feedback && ` — "${msg.resolution.feedback}"`}
        </div>
      )}
    </div>
  );
}

// Strip web search citation tags: <cite index="...">...</cite>
function stripCites(text: string | undefined): string {
  if (!text) return "";
  return text.replace(/<cite[^>]*>(.*?)<\/cite>/gs, "$1").trim();
}

// ─────────────────────────────────────────────
// Content review body with expandable draft
// ─────────────────────────────────────────────

function ContentReviewBody({ payload }: { payload: CheckpointPayload }) {
  const [draftExpanded, setDraftExpanded] = useState(false);
  const PREVIEW_CHARS = 800;
  const draft = payload.draft_md ?? "";
  const isLong = draft.length > PREVIEW_CHARS;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {payload.verdict && (
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 12px", borderRadius: 20, background: "rgba(0,212,255,0.1)", color: "var(--accent-cyan)", fontSize: 12, fontWeight: 600 }}>
          🔍 Vera Veredito: {payload.verdict}
        </div>
      )}
      {draft && (
        <div style={{ border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
          <div
            style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 10px", background: "rgba(255,255,255,0.02)", borderBottom: "1px solid var(--border)", cursor: isLong ? "pointer" : "default" }}
            onClick={() => isLong && setDraftExpanded((e) => !e)}
          >
            <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-secondary)" }}>📄 Conteúdo gerado</span>
            {isLong && <span style={{ fontSize: 10, color: "var(--accent-cyan)", fontWeight: 600 }}>{draftExpanded ? "Recolher ▲" : "Ver tudo ▼"}</span>}
          </div>
          <pre style={{ ...previewStyle }}>
            {draftExpanded ? draft : draft.slice(0, PREVIEW_CHARS)}
            {!draftExpanded && isLong && <span style={{ color: "var(--text-secondary)" }}>{"\n"}…</span>}
          </pre>
        </div>
      )}
      {payload.review_md && (
        <details>
          <summary style={{ fontSize: 11, color: "var(--text-secondary)", cursor: "pointer", padding: "4px 0", userSelect: "none" }}>
            Ver revisão completa ▾
          </summary>
          <pre style={{ ...previewStyle, marginTop: 6 }}>
            {payload.review_md}
          </pre>
        </details>
      )}
    </div>
  );
}


// ─────────────────────────────────────────────
// Checkpoint body — renders per type
// ─────────────────────────────────────────────

function CheckpointBody({
  payload,
  selected,
  onSelect,
}: {
  payload: CheckpointPayload;
  selected: string | null;
  onSelect: (key: string, value: unknown) => void;
}) {
  switch (payload.type) {
    case "period_selection":
      return (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {payload.options?.map((opt) => (
            <OptionCard
              key={opt.value}
              label={opt.label}
              description={opt.description}
              selected={selected === opt.value}
              onClick={() => onSelect(opt.value, opt.value)}
            />
          ))}
        </div>
      );

    case "story_selection":
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {(payload.stories?.length ?? 0) === 0 && (
            <div style={{ fontSize: 12, color: "var(--text-secondary)", padding: 8 }}>
              Nenhuma notícia encontrada. Reinicie o squad para pesquisar novamente.
            </div>
          )}
          {payload.stories?.map((story: CheckpointStory, i: number) => (
            <StoryCard
              key={i}
              story={story}
              index={i}
              selected={selected === String(i)}
              onClick={() => onSelect(String(i), story)}
            />
          ))}
        </div>
      );

    case "content_review":
      return <ContentReviewBody payload={payload} />;

    case "design_approval":
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Card preview — JPG preferred, HTML iframe fallback */}
          {payload.slides && payload.slides.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {payload.slides.map((url: string) => (
                <img
                  key={url}
                  src={url}
                  alt="Card gerado"
                  style={{ width: "100%", borderRadius: 8, border: "1px solid var(--border)" }}
                />
              ))}
            </div>
          ) : payload.card_html_url ? (
            <div style={{ position: "relative" }}>
              <iframe
                src={payload.card_html_url}
                style={{
                  width: "100%",
                  height: 420,
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  background: "#000",
                  display: "block",
                }}
                title="Card preview"
              />
              <a
                href={payload.card_html_url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  position: "absolute",
                  top: 8,
                  right: 8,
                  fontSize: 10,
                  padding: "3px 8px",
                  background: "rgba(0,0,0,0.7)",
                  color: "var(--accent-cyan)",
                  borderRadius: 4,
                  textDecoration: "none",
                  fontWeight: 600,
                }}
              >
                ↗ Abrir
              </a>
            </div>
          ) : (
            <div style={{ fontSize: 12, color: "var(--text-secondary)", padding: "16px 0", textAlign: "center" }}>
              Aguardando card do Marco Design...
            </div>
          )}

          {/* Caption preview */}
          {payload.caption && (
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
                Legenda do post
              </div>
              <pre style={{ ...previewStyle, fontSize: 11 }}>
                {payload.caption}
              </pre>
            </div>
          )}
        </div>
      );

    default:
      return null;
  }
}

// ─────────────────────────────────────────────
// Tiny UI atoms
// ─────────────────────────────────────────────

function OptionCard({
  label,
  description,
  selected,
  onClick,
}: {
  label: string;
  description?: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        minWidth: 120,
        padding: "10px 14px",
        background: selected ? "rgba(0,212,255,0.12)" : "rgba(255,255,255,0.03)",
        border: `1px solid ${selected ? "var(--accent-cyan)" : "var(--border)"}`,
        borderRadius: 8,
        cursor: "pointer",
        textAlign: "left",
        fontFamily: "inherit",
        transition: "all 0.15s",
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 600, color: selected ? "var(--accent-cyan)" : "var(--text-primary)" }}>
        {label}
      </div>
      {description && (
        <div style={{ fontSize: 10, color: "var(--text-secondary)", marginTop: 3, lineHeight: 1.4 }}>
          {description}
        </div>
      )}
    </button>
  );
}

function StoryCard({
  story,
  index,
  selected,
  onClick,
}: {
  story: CheckpointStory;
  index?: number;
  selected: boolean;
  onClick: () => void;
}) {
  const rank = story.rank ?? (index !== undefined ? index + 1 : undefined);
  const summary = stripCites(story.summary || story.why_interesting);
  return (
    <button
      onClick={onClick}
      style={{
        padding: "8px 12px",
        background: selected ? "rgba(0,212,255,0.1)" : "rgba(255,255,255,0.02)",
        border: `1px solid ${selected ? "var(--accent-cyan)" : "var(--border)"}`,
        borderRadius: 8,
        cursor: "pointer",
        textAlign: "left",
        fontFamily: "inherit",
        transition: "all 0.15s",
        width: "100%",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
        {rank && (
          <span
            style={{
              fontSize: 9,
              fontWeight: 700,
              padding: "2px 5px",
              borderRadius: 4,
              background: selected ? "rgba(0,212,255,0.2)" : "rgba(0,212,255,0.08)",
              color: "var(--accent-cyan)",
              flexShrink: 0,
              marginTop: 1,
            }}
          >
            #{rank}
          </span>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: selected ? "var(--accent-cyan)" : "var(--text-primary)", lineHeight: 1.4 }}>
            {story.title}
          </div>
          {summary && (
            <div style={{
              fontSize: 11,
              color: "var(--text-secondary)",
              marginTop: 3,
              lineHeight: 1.4,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            } as React.CSSProperties}>
              {summary}
            </div>
          )}
          {story.source && (
            <div style={{ fontSize: 10, color: "var(--text-secondary)", marginTop: 2, opacity: 0.7 }}>
              {story.source}
            </div>
          )}
          {story.url && (
            <a
              href={story.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: 10, color: "var(--accent-cyan)", marginTop: 2, display: "block", textDecoration: "none" }}
              onClick={(e) => e.stopPropagation()}
            >
              🔗 Verificar fonte
            </a>
          )}
        </div>
      </div>
    </button>
  );
}

function OutputCard({ file, content }: { file: string; content: string; step: string }) {
  const [expanded, setExpanded] = useState(false);
  const PREVIEW_CHARS = 600;
  const preview = content.slice(0, PREVIEW_CHARS);
  const isLong = content.length > PREVIEW_CHARS;

  return (
    <div
      style={{
        border: "1px solid var(--border)",
        borderRadius: 8,
        overflow: "hidden",
        background: "rgba(255,255,255,0.02)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "6px 10px",
          background: "rgba(255,255,255,0.02)",
          borderBottom: "1px solid var(--border)",
          cursor: isLong ? "pointer" : "default",
        }}
        onClick={() => isLong && setExpanded((e) => !e)}
      >
        <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-secondary)" }}>
          📄 {file}
        </span>
        {isLong && (
          <span style={{ fontSize: 10, color: "var(--accent-cyan)", fontWeight: 600 }}>
            {expanded ? "Recolher ▲" : "Ver tudo ▼"}
          </span>
        )}
      </div>
      <pre
        style={{
          fontSize: 11,
          color: "var(--text-primary)",
          padding: "8px 10px",
          margin: 0,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          lineHeight: 1.6,
          transition: "none",
        }}
      >
        {expanded ? content : preview}
        {!expanded && isLong && (
          <span style={{ color: "var(--text-secondary)" }}>{"\n"}…</span>
        )}
      </pre>
    </div>
  );
}

function AgentAvatar({
  agent,
  working,
  done,
}: {
  agent: { icon: string; name: string };
  working: boolean;
  done?: boolean;
}) {
  return (
    <div
      style={{
        width: 36,
        height: 36,
        borderRadius: "50%",
        background: working
          ? "linear-gradient(135deg, #22c55e44, #16a34a44)"
          : done
          ? "linear-gradient(135deg, #06b6d444, #0284c744)"
          : "linear-gradient(135deg, #1e293b, #334155)",
        border: `2px solid ${working ? "#22c55e" : done ? "var(--accent-cyan)" : "var(--border)"}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 18,
        flexShrink: 0,
        boxShadow: working ? "0 0 10px #22c55e44" : undefined,
        transition: "all 0.3s",
      }}
    >
      {agent.icon}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const c = {
    running: { bg: "rgba(34,197,94,0.15)", color: "#22c55e", label: "Rodando" },
    checkpoint: { bg: "rgba(251,191,36,0.15)", color: "#fbbf24", label: "Aguardando" },
    completed: { bg: "rgba(6,182,212,0.15)", color: "#06b6d4", label: "Concluído" },
  }[status] ?? { bg: "rgba(148,163,184,0.1)", color: "#94a3b8", label: status };

  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 700,
        padding: "3px 10px",
        borderRadius: 20,
        background: c.bg,
        color: c.color,
        textTransform: "uppercase",
        letterSpacing: 0.6,
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        flexShrink: 0,
      }}
    >
      <span
        style={{
          width: 5,
          height: 5,
          borderRadius: "50%",
          background: c.color,
          display: "inline-block",
          boxShadow: status === "running" ? `0 0 4px ${c.color}` : undefined,
          animation: status === "running" ? "pulse 2s infinite" : undefined,
        }}
      />
      {c.label}
    </span>
  );
}

function PulsingDot() {
  return (
    <span
      style={{
        display: "inline-flex",
        gap: 3,
        alignItems: "center",
        marginLeft: 6,
      }}
    >
      {[0, 150, 300].map((delay) => (
        <span
          key={delay}
          style={{
            width: 4,
            height: 4,
            borderRadius: "50%",
            background: "var(--accent-green)",
            animation: `pulse 1.2s ${delay}ms infinite`,
          }}
        />
      ))}
    </span>
  );
}

function TypingIndicator({ agents }: { agents: { name: string; icon: string }[] }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 16px" }}>
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: "50%",
          background: "linear-gradient(135deg, #22c55e22, #16a34a22)",
          border: "1px solid #22c55e",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 14,
        }}
      >
        {agents[0]?.icon}
      </div>
      <div
        style={{
          fontSize: 11,
          color: "var(--text-secondary)",
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        <span>{agents.map((a) => a.name).join(", ")}</span>
        <PulsingDot />
      </div>
    </div>
  );
}

function ActionBtn({
  children,
  color,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  color: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: "6px 16px",
        background: disabled ? "transparent" : `${color}18`,
        border: `1px solid ${disabled ? "var(--border)" : color}`,
        borderRadius: 8,
        color: disabled ? "var(--text-secondary)" : color,
        cursor: disabled ? "not-allowed" : "pointer",
        fontSize: 12,
        fontFamily: "inherit",
        fontWeight: 700,
        letterSpacing: 0.3,
        transition: "all 0.15s",
      }}
    >
      {children}
    </button>
  );
}

// ─────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────

function checkpointBtnStyle(style: string): React.CSSProperties {
  const base: React.CSSProperties = {
    padding: "7px 16px",
    borderRadius: 8,
    cursor: "pointer",
    fontSize: 12,
    fontFamily: "inherit",
    fontWeight: 600,
    border: "1px solid",
    transition: "all 0.15s",
  };
  switch (style) {
    case "primary":
      return { ...base, background: "rgba(34,197,94,0.15)", borderColor: "#22c55e", color: "#22c55e" };
    case "secondary":
      return { ...base, background: "rgba(6,182,212,0.1)", borderColor: "var(--accent-cyan)", color: "var(--accent-cyan)" };
    case "danger":
      return { ...base, background: "rgba(239,68,68,0.1)", borderColor: "#ef4444", color: "#ef4444" };
    case "ghost":
    default:
      return { ...base, background: "transparent", borderColor: "var(--border)", color: "var(--text-secondary)" };
  }
}

const panelStyle: React.CSSProperties = {
  flex: 1,
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
  background: "#0d0d18",
};

const emptyStyle: React.CSSProperties = {
  flex: 1,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 12,
  background: "#0d0d18",
};

const chatHeaderStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "12px 16px",
  borderBottom: "1px solid var(--border)",
  background: "var(--bg-sidebar)",
  gap: 12,
  flexShrink: 0,
};

const messagesStyle: React.CSSProperties = {
  flex: 1,
  overflowY: "auto",
  padding: "12px 0",
  display: "flex",
  flexDirection: "column",
  gap: 2,
};

const inputAreaStyle: React.CSSProperties = {
  display: "flex",
  gap: 8,
  padding: "12px 16px",
  borderTop: "1px solid var(--border)",
  background: "var(--bg-sidebar)",
  alignItems: "flex-end",
  flexShrink: 0,
};

const textareaStyle: React.CSSProperties = {
  flex: 1,
  background: "rgba(255,255,255,0.04)",
  border: "1px solid var(--border)",
  borderRadius: 10,
  padding: "10px 14px",
  color: "var(--text-primary)",
  fontSize: 13,
  fontFamily: "inherit",
  resize: "none",
  outline: "none",
  lineHeight: 1.5,
};

const sendBtnStyle = (active: boolean): React.CSSProperties => ({
  width: 36,
  height: 36,
  borderRadius: "50%",
  background: active ? "var(--accent-cyan)" : "var(--border)",
  border: "none",
  color: active ? "#000" : "var(--text-secondary)",
  cursor: active ? "pointer" : "not-allowed",
  fontSize: 16,
  fontWeight: 700,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
  transition: "all 0.15s",
});

const agentBubbleStyle: React.CSSProperties = {
  display: "flex",
  gap: 10,
  padding: "8px 16px",
  alignItems: "flex-start",
};

const agentHeaderStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 2,
  marginBottom: 4,
};

const previewStyle: React.CSSProperties = {
  fontSize: 11,
  color: "var(--text-primary)",
  background: "rgba(255,255,255,0.03)",
  border: "1px solid var(--border)",
  borderRadius: 6,
  padding: "10px 12px",
  margin: 0,
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
  lineHeight: 1.6,
};
