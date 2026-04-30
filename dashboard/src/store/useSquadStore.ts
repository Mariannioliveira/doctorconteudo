import { create } from "zustand";
import type { SquadInfo, SquadState } from "@/types/state";
import type { ChatMessage } from "@/types/chat";

interface SquadStore {
  // WebSocket state
  squads: Map<string, SquadInfo>;
  activeStates: Map<string, SquadState>;
  selectedSquad: string | null;
  selectedAgent: string | null;
  isConnected: boolean;

  // Chat messages per squad
  chatMessages: Map<string, ChatMessage[]>;
  // Live streaming token buffer per squad (agent_token accumulation)
  tokenBuffer: Map<string, string>;

  // Selectors
  selectSquad: (name: string | null) => void;
  selectAgent: (agentId: string | null) => void;
  setConnected: (connected: boolean) => void;

  // WebSocket handlers
  setSnapshot: (squads: SquadInfo[], activeStates: Record<string, SquadState>) => void;
  setSquadActive: (squad: string, state: SquadState) => void;
  updateSquadState: (squad: string, state: SquadState) => void;
  setSquadInactive: (squad: string) => void;

  // Chat handlers
  addMessage: (squad: string, msg: ChatMessage) => void;
  resolveCheckpoint: (squad: string, stepId: string, action: string, feedback?: string) => void;
  appendToken: (squad: string, agentId: string, token: string) => void;
  flushTokenBuffer: (squad: string, agentId: string) => void;
  clearChat: (squad: string) => void;

  // API actions
  startSquad: (squad: string) => Promise<{ run_id?: string; error?: string }>;
  stopSquad: (squad: string) => Promise<void>;
  submitCheckpoint: (squad: string, stepId: string, action: string, value?: unknown, feedback?: string) => Promise<void>;
}

let _msgCounter = 0;
function nextId() { return `msg-${++_msgCounter}-${Date.now()}`; }

const SESSION_KEY = "opensquad:chatMessages";

function saveMessagesToSession(chatMessages: Map<string, ChatMessage[]>) {
  try {
    const plain: Record<string, ChatMessage[]> = {};
    chatMessages.forEach((msgs, squad) => {
      // Never persist checkpoint messages — server always replays them on reconnect,
      // storing them causes duplicates and stale payloads on reload.
      plain[squad] = msgs.filter((m) => m.type !== "checkpoint");
    });
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(plain));
  } catch { /* quota exceeded or private mode */ }
}

function loadMessagesFromSession(): Map<string, ChatMessage[]> {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return new Map();
    const plain = JSON.parse(raw) as Record<string, ChatMessage[]>;
    return new Map(Object.entries(plain));
  } catch { return new Map(); }
}

export const useSquadStore = create<SquadStore>((set, get) => ({
  squads: new Map(),
  activeStates: new Map(),
  selectedSquad: null,
  selectedAgent: null,
  isConnected: false,
  chatMessages: loadMessagesFromSession(),
  tokenBuffer: new Map(),

  selectSquad: (name: string | null) => set({ selectedSquad: name, selectedAgent: null }),
  selectAgent: (agentId: string | null) => set({ selectedAgent: agentId }),
  setConnected: (connected: boolean) => set({ isConnected: connected }),

  setSnapshot: (squads: SquadInfo[], activeStates: Record<string, SquadState>) =>
    set({
      squads: new Map(squads.map((s) => [s.code, s])),
      activeStates: new Map(Object.entries(activeStates)),
    }),

  setSquadActive: (squad: string, state: SquadState) =>
    set((prev) => ({
      activeStates: new Map(prev.activeStates).set(squad, state),
    })),

  updateSquadState: (squad: string, state: SquadState) =>
    set((prev) => ({
      activeStates: new Map(prev.activeStates).set(squad, state),
    })),

  setSquadInactive: (squad: string) =>
    set((prev) => {
      const next = new Map(prev.activeStates);
      next.delete(squad);
      return {
        activeStates: next,
        selectedSquad: prev.selectedSquad === squad ? null : prev.selectedSquad,
      };
    }),

  addMessage: (squad: string, msg: ChatMessage) =>
    set((prev) => {
      const existing = prev.chatMessages.get(squad) ?? [];
      // Deduplicate checkpoints: replace an existing unresolved checkpoint for the same step
      // instead of appending. This prevents duplicates on SSE reconnect.
      let base = existing;
      if (msg.type === "checkpoint") {
        base = existing.filter(
          (m) => !(m.type === "checkpoint" && m.stepId === (msg as Extract<ChatMessage, { type: "checkpoint" }>).stepId && !m.resolved)
        );
      }
      const msgs = [...base, msg];
      const next = new Map(prev.chatMessages).set(squad, msgs);
      saveMessagesToSession(next);
      return { chatMessages: next };
    }),

  resolveCheckpoint: (squad: string, stepId: string, action: string, feedback?: string) =>
    set((prev) => {
      const msgs = (prev.chatMessages.get(squad) ?? []).map((m) =>
        m.type === "checkpoint" && m.stepId === stepId
          ? { ...m, resolved: true, resolution: { action, feedback } }
          : m
      );
      const next = new Map(prev.chatMessages).set(squad, msgs);
      saveMessagesToSession(next);
      return { chatMessages: next };
    }),

  appendToken: (squad: string, agentId: string, token: string) =>
    set((prev) => {
      const key = `${squad}:${agentId}`;
      const current = prev.tokenBuffer.get(key) ?? "";
      return { tokenBuffer: new Map(prev.tokenBuffer).set(key, current + token) };
    }),

  flushTokenBuffer: (squad: string, agentId: string) =>
    set((prev) => {
      const key = `${squad}:${agentId}`;
      const next = new Map(prev.tokenBuffer);
      next.delete(key);
      return { tokenBuffer: next };
    }),

  clearChat: (squad: string) =>
    set((prev) => ({
      chatMessages: new Map(prev.chatMessages).set(squad, []),
    })),

  startSquad: async (squad: string) => {
    // Optimistic state — flip UI immediately, WS broadcast will hydrate with real status
    const info = get().squads.get(squad);
    if (info) {
      const optimistic: SquadState = {
        squad,
        status: "running",
        step: { current: 0, total: 0, label: "Iniciando..." },
        agents: info.agents.map((a, i) => ({
          id: a.id,
          name: a.name,
          icon: a.icon,
          status: "idle",
          deliverTo: null,
          desk: { col: (i % 3) + 1, row: Math.floor(i / 3) + 1 },
        })),
        handoff: null,
        startedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      get().setSquadActive(squad, optimistic);
    }

    try {
      const res = await fetch(`/api/squads/${squad}/run`, { method: "POST" });
      const data = await res.json().catch(() => ({}));

      if (res.status === 409) {
        // Already running — fetch real state to hydrate, then load pending checkpoint
        try {
          const stateRes = await fetch(`/api/squads/${squad}`);
          if (stateRes.ok) {
            const sq = await stateRes.json();
            if (sq?.state) get().setSquadActive(squad, sq.state);
          }
        } catch { /* keep optimistic state */ }

        get().addMessage(squad, {
          id: nextId(),
          type: "system",
          content: "Squad já está rodando. Reconectando...",
          variant: "info",
          timestamp: new Date().toISOString(),
        });
        const pendingRes = await fetch(`/api/squads/${squad}/pending`);
        if (pendingRes.ok) {
          const pending = await pendingRes.json();
          if (pending.pendingCheckpoint) {
            const cp = pending.pendingCheckpoint;
            get().addMessage(squad, {
              id: nextId(),
              type: "checkpoint",
              stepId: cp.step_id,
              stepName: cp.step_name ?? cp.step_id,
              payload: cp,
              resolved: false,
              timestamp: new Date().toISOString(),
            });
          }
        }
        return { run_id: "existing" };
      }

      if (!res.ok) {
        // Roll back optimistic state on failure
        get().setSquadInactive(squad);
        return { error: data.error ?? "Erro ao iniciar" };
      }

      get().addMessage(squad, {
        id: nextId(),
        type: "system",
        content: `Pipeline iniciado — ${data.run_id}`,
        variant: "info",
        timestamp: new Date().toISOString(),
      });

      return { run_id: data.run_id };
    } catch (e) {
      get().setSquadInactive(squad);
      return { error: String(e) };
    }
  },

  stopSquad: async (squad: string) => {
    // Optimistic transition — show all agents as "idle" (parando) immediately
    const current = get().activeStates.get(squad);
    if (current) {
      get().updateSquadState(squad, {
        ...current,
        status: "idle",
        agents: current.agents.map((a) => ({ ...a, status: "idle" })),
        updatedAt: new Date().toISOString(),
      });
    }
    get().addMessage(squad, {
      id: nextId(),
      type: "system",
      content: "Parando agentes...",
      variant: "warning",
      timestamp: new Date().toISOString(),
    });

    try {
      await fetch(`/api/squads/${squad}/stop`, { method: "POST" });
      get().addMessage(squad, {
        id: nextId(),
        type: "system",
        content: "Squad parado.",
        variant: "warning",
        timestamp: new Date().toISOString(),
      });
    } catch (e) {
      console.error("Stop squad error:", e);
    }
  },

  submitCheckpoint: async (squad: string, stepId: string, action: string, value?: unknown, feedback?: string) => {
    try {
      const res = await fetch(`/api/squads/${squad}/checkpoint`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step_id: stepId, action, value: value ?? null, feedback: feedback ?? null }),
      });
      if (res.ok) {
        get().resolveCheckpoint(squad, stepId, action, feedback);
      }
    } catch (e) {
      console.error("Checkpoint error:", e);
    }
  },
}));
