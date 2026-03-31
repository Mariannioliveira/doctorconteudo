import { useEffect } from "react";
import { useRunStore } from "@/store/useRunStore";

/**
 * Connects to the SSE stream for the given runId and populates
 * the run store with live events (tokens, checkpoints, completion).
 *
 * Safe to call with null — does nothing until a runId is provided.
 */
export function useRunStream(runId: string | null) {
  useEffect(() => {
    if (!runId) return;

    useRunStore.getState().clearOutput();

    const es = new EventSource(`/api/runs/${runId}/stream`);

    const on = (event: string, cb: (data: unknown) => void) => {
      es.addEventListener(event, (e: MessageEvent) => {
        try {
          cb(JSON.parse(e.data));
        } catch {
          // ignore malformed payloads
        }
      });
    };

    on("step_start", (data: any) => {
      const store = useRunStore.getState();
      store.setCheckpoint(null);
      store.setRunError(null);
      store.setCurrentAgent({ id: data.agent_id, name: data.agent_name, icon: data.agent_icon });
      store.clearOutput();
      store.updateRunStatus(runId, "running", data.step_id);
    });

    on("agent_token", (data: any) => {
      useRunStore.getState().appendToken(data.token ?? "");
    });

    on("step_done", (data: any) => {
      useRunStore.getState().updateRunStatus(runId, "running", data.step_id);
    });

    on("checkpoint", (data: any) => {
      const store = useRunStore.getState();
      store.setCheckpoint(data);
      store.setCurrentAgent(null);
      store.updateRunStatus(runId, "checkpoint", data.step_id);
    });

    on("checkpoint_resolved", (data: any) => {
      const store = useRunStore.getState();
      store.setCheckpoint(null);
      store.updateRunStatus(runId, "running", data.step_id);
    });

    on("run_complete", (data: any) => {
      const store = useRunStore.getState();
      store.setCheckpoint(null);
      store.setCurrentAgent(null);
      store.updateRunStatus(runId, data.status ?? "completed");
      es.close();
    });

    on("run_error", (data: any) => {
      const store = useRunStore.getState();
      store.setRunError(data.error ?? "Erro desconhecido");
      store.setCheckpoint(null);
      store.setCurrentAgent(null);
      store.updateRunStatus(runId, "error");
      es.close();
    });

    return () => {
      es.close();
    };
  }, [runId]);
}
