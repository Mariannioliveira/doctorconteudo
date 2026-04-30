import { useEffect, useRef } from "react";
import { useSquadStore } from "@/store/useSquadStore";
import type { ChatMessage } from "@/types/chat";

let _id = 0;
function nextId() { return `stream-${++_id}-${Date.now()}`; }

export function useSquadStream(squadCode: string | null) {
  const esRef = useRef<EventSource | null>(null);
  const addMessage = useSquadStore((s) => s.addMessage);
  const appendToken = useSquadStore((s) => s.appendToken);
  const resolveCheckpoint = useSquadStore((s) => s.resolveCheckpoint);
  const activeState = useSquadStore((s) =>
    squadCode ? s.activeStates.get(squadCode) : undefined
  );

  const isRunning = activeState?.status === "running" || activeState?.status === "checkpoint";

  useEffect(() => {
    if (!squadCode || !isRunning) {
      esRef.current?.close();
      esRef.current = null;
      return;
    }

    // Don't reconnect if already open for this squad
    if (esRef.current) return;

    const es = new EventSource(`/api/squads/${squadCode}/stream`);
    esRef.current = es;

    es.addEventListener("connected", () => {
      // Connected — start listening
    });

    es.addEventListener("step_start", (e) => {
      const d = JSON.parse(e.data);
      const msg: ChatMessage = {
        id: nextId(),
        type: "agent_start",
        agent: { id: d.agent_id, name: d.agent_name, icon: d.agent_icon },
        stepId: d.step_id,
        stepName: d.step_name,
        timestamp: new Date().toISOString(),
      };
      addMessage(squadCode, msg);
    });

    es.addEventListener("agent_token", (e) => {
      const d = JSON.parse(e.data);
      appendToken(squadCode, d.agent_id ?? "unknown", d.token ?? "");
    });

    es.addEventListener("step_done", (e) => {
      const d = JSON.parse(e.data);
      const msg: ChatMessage = {
        id: nextId(),
        type: "agent_output",
        agent: { id: d.agent_id, name: d.agent_name, icon: d.agent_icon },
        stepId: d.step_id,
        stepName: d.step_name,
        timestamp: new Date().toISOString(),
        outputs: d.outputs ?? [],
      };
      addMessage(squadCode, msg);
    });

    es.addEventListener("checkpoint", (e) => {
      const d = JSON.parse(e.data);
      const msg: ChatMessage = {
        id: nextId(),
        type: "checkpoint",
        stepId: d.step_id,
        stepName: d.step_name,
        payload: d,
        resolved: false,
        timestamp: new Date().toISOString(),
      };
      addMessage(squadCode, msg);
    });

    es.addEventListener("checkpoint_resolved", (e) => {
      const d = JSON.parse(e.data);
      resolveCheckpoint(squadCode, d.step_id, d.action);
    });

    es.addEventListener("run_complete", (e) => {
      const d = JSON.parse(e.data);
      const msg: ChatMessage = {
        id: nextId(),
        type: "system",
        content: d.message ?? "Pipeline concluído!",
        variant: "success",
        timestamp: new Date().toISOString(),
      };
      addMessage(squadCode, msg);
      es.close();
      esRef.current = null;
    });

    es.addEventListener("run_error", (e) => {
      const d = JSON.parse(e.data);
      const msg: ChatMessage = {
        id: nextId(),
        type: "system",
        content: `Erro: ${d.error}`,
        variant: "error",
        timestamp: new Date().toISOString(),
      };
      addMessage(squadCode, msg);
      es.close();
      esRef.current = null;
    });

    es.onerror = () => {
      // SSE will auto-reconnect; just ignore transient errors
    };

    return () => {
      es.close();
      esRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [squadCode, isRunning]);
}
