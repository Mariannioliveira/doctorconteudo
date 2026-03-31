import { create } from "zustand";
import type { RunListItem, CheckpointPayload } from "@/types/run";

interface RunStore {
  // Run list (from /api/runs)
  runs: RunListItem[];
  // Currently observed run
  activeRunId: string | null;
  // Live streaming output (last ~4000 chars)
  liveOutput: string;
  // Current checkpoint waiting for user decision
  checkpoint: CheckpointPayload | null;
  // Last agent info (from step_start)
  currentAgent: { id: string; name: string; icon: string } | null;
  // Error message if run errored
  runError: string | null;

  // Actions
  setRuns: (runs: RunListItem[]) => void;
  addRun: (run: RunListItem) => void;
  setActiveRun: (run_id: string | null) => void;
  appendToken: (token: string) => void;
  clearOutput: () => void;
  setCheckpoint: (payload: CheckpointPayload | null) => void;
  setCurrentAgent: (agent: { id: string; name: string; icon: string } | null) => void;
  setRunError: (msg: string | null) => void;
  updateRunStatus: (
    run_id: string,
    status: RunListItem["status"],
    current_step?: string | null
  ) => void;
}

export const useRunStore = create<RunStore>((set) => ({
  runs: [],
  activeRunId: null,
  liveOutput: "",
  checkpoint: null,
  currentAgent: null,
  runError: null,

  setRuns: (runs) => set({ runs }),

  addRun: (run) =>
    set((s) => ({ runs: [run, ...s.runs.filter((r) => r.run_id !== run.run_id)] })),

  setActiveRun: (run_id) =>
    set({ activeRunId: run_id, liveOutput: "", checkpoint: null, runError: null, currentAgent: null }),

  appendToken: (token) =>
    set((s) => ({ liveOutput: (s.liveOutput + token).slice(-5000) })),

  clearOutput: () => set({ liveOutput: "" }),

  setCheckpoint: (checkpoint) => set({ checkpoint }),

  setCurrentAgent: (currentAgent) => set({ currentAgent }),

  setRunError: (runError) => set({ runError }),

  updateRunStatus: (run_id, status, current_step) =>
    set((s) => ({
      runs: s.runs.map((r) =>
        r.run_id === run_id
          ? { ...r, status, current_step: current_step ?? r.current_step }
          : r
      ),
    })),
}));
