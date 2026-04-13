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

export const useSquadStore = create<SquadStore>((set, get) => ({
  squads: new Map(),
  activeStates: new Map(),
  selectedSquad: null,
  selectedAgent: null,
  isConnected: false,
  chatMessages: new Map(),
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
      const msgs = [...(prev.chatMessages.get(squad) ?? []), msg];
      return { chatMessages: new Map(prev.chatMessages).set(squad, msgs) };
    }),

  resolveCheckpoint: (squad: string, stepId: string, action: string, feedback?: string) =>
    set((prev) => {
      const msgs = (prev.chatMessages.get(squad) ?? []).map((m) =>
        m.type === "checkpoint" && m.stepId === stepId
          ? { ...m, resolved: true, resolution: { action, feedback } }
          : m
      );
      return { chatMessages: new Map(prev.chatMessages).set(squad, msgs) };
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
    try {
      const res = await fetch(`/api/squads/${squad}/run`, { method: "POST" });
      const data = await res.json().catch(() => ({}));

      if (res.status === 409) {
        // Already running — load pending state and reconnect
        get().addMessage(squad, {
          id: nextId(),
          type: "system",
          content: "Squad já está rodando. Reconectando...",
          variant: "info",
          timestamp: new Date().toISOString(),
        });
        // Fetch pending checkpoint if any
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

      if (!res.ok) return { error: data.error ?? "Erro ao iniciar" };

      get().addMessage(squad, {
        id: nextId(),
        type: "system",
        content: `Pipeline iniciado — ${data.run_id}`,
        variant: "info",
        timestamp: new Date().toISOString(),
      });

      return { run_id: data.run_id };
    } catch (e) {
      return { error: String(e) };
    }
  },

  stopSquad: async (squad: string) => {
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
