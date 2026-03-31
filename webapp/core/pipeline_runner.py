"""
Central pipeline orchestrator.
Runs steps in sequence, pausing at checkpoints via asyncio.Event.
Emits SSE events via RunContext.sse_queue.
"""
import asyncio
from datetime import datetime, timezone

from .models import RunContext, StepInfo
from .config import SQUAD_ROOT
from .file_manager import (
    load_pipeline_yaml, load_squad_yaml,
    save_run_state, save_checkpoint_decision,
    now_iso, get_run_dir
)
from .checkpoint_handler import build_payload
from . import agent_executor


# ─────────────────────────────────────────────
#  Agent metadata lookup
# ─────────────────────────────────────────────

def _agent_lookup(squad_yaml: dict) -> dict:
    """Returns {agent_id: {name, icon}} from squad.yaml."""
    return {
        a["id"]: {"name": a.get("name", a["id"]), "icon": a.get("icon", "🤖")}
        for a in squad_yaml.get("agents", [])
    }


# ─────────────────────────────────────────────
#  Step file name resolution
# ─────────────────────────────────────────────

def _step_file(step_id: str, pipeline: dict) -> str | None:
    for s in pipeline.get("steps", []):
        if s["id"] == step_id:
            return s.get("file")
    return None


# ─────────────────────────────────────────────
#  Build initial run state
# ─────────────────────────────────────────────

def _build_initial_state(run_id: str, pipeline: dict, squad_yaml: dict) -> dict:
    agents = _agent_lookup(squad_yaml)
    steps = []
    for s in pipeline.get("steps", []):
        agent_id = s.get("agent")
        agent_info = agents.get(agent_id, {}) if agent_id else {}
        steps.append({
            "id": s["id"],
            "name": s.get("name", s["id"]),
            "type": s.get("type", "agent"),
            "agent": agent_id,
            "agent_name": agent_info.get("name"),
            "agent_icon": agent_info.get("icon"),
            "status": "pending",
        })
    ts = now_iso()
    return {
        "run_id": run_id,
        "squad": squad_yaml.get("code", "conteudo-social-medicos"),
        "status": "running",
        "current_step": None,
        "steps": steps,
        "started_at": ts,
        "updated_at": ts,
    }


def _update_step_status(state: dict, step_id: str, status: str):
    for s in state["steps"]:
        if s["id"] == step_id:
            s["status"] = status
    state["current_step"] = step_id
    state["updated_at"] = now_iso()


# ─────────────────────────────────────────────
#  Main pipeline coroutine
# ─────────────────────────────────────────────

async def run_pipeline(run_id: str, run_ctx: RunContext):
    pipeline = load_pipeline_yaml()
    squad_yaml = load_squad_yaml()
    state = _build_initial_state(run_id, pipeline, squad_yaml)
    save_run_state(state)

    last_decision: dict | None = None
    steps = pipeline.get("steps", [])

    try:
        for step in steps:
            step_id = step["id"]
            step_type = step.get("type", "agent")
            step_name = step.get("name", step_id)

            _update_step_status(state, step_id, "running")
            save_run_state(state)

            # ─────────────────────────────────────────
            #  CHECKPOINT
            # ─────────────────────────────────────────
            if step_type == "checkpoint":
                _update_step_status(state, step_id, "waiting")
                state["status"] = "checkpoint"
                save_run_state(state)

                payload = build_payload(step_id, run_id)
                await run_ctx.emit("checkpoint", {
                    "step_id": step_id,
                    "step_name": step_name,
                    **payload
                })

                # Block until user responds
                await run_ctx.checkpoint_event.wait()
                run_ctx.checkpoint_event.clear()

                decision = run_ctx.checkpoint_decision or {}
                last_decision = decision
                action = decision.get("action", "")

                # Save decision to file
                save_checkpoint_decision(run_id, step_id, decision)

                # Handle terminal actions
                if action == "save_draft":
                    _update_step_status(state, step_id, "done")
                    state["status"] = "saved_draft"
                    save_run_state(state)
                    await run_ctx.emit("run_complete", {
                        "run_id": run_id,
                        "status": "saved_draft",
                        "message": "Rascunho salvo com sucesso."
                    })
                    return

                if action == "save" and step_id == "step-10":
                    _update_step_status(state, step_id, "done")
                    state["status"] = "completed"
                    save_run_state(state)
                    await run_ctx.emit("run_complete", {
                        "run_id": run_id,
                        "status": "completed",
                        "message": "Card salvo sem publicação."
                    })
                    return

                # Handle "retry" flows — adjust_copy goes back to step-05
                if action == "adjust_copy" and step_id == "step-08":
                    # Re-run step-05 with feedback
                    _update_step_status(state, step_id, "done")
                    state["status"] = "running"
                    save_run_state(state)
                    await run_ctx.emit("checkpoint_resolved", {"step_id": step_id, "action": action})
                    # Insert a synthetic step-05 re-execution
                    step_05 = next((s for s in steps if s["id"] == "step-05"), None)
                    if step_05:
                        await _run_agent_step(step_05, run_id, state, run_ctx, last_decision)
                    # Then continue to re-run step-07
                    step_07 = next((s for s in steps if s["id"] == "step-07"), None)
                    if step_07:
                        await _run_agent_step(step_07, run_id, state, run_ctx, last_decision)
                    # And re-present step-08 checkpoint
                    continue

                if action == "change_angle" and step_id == "step-06":
                    # Go back to strategist
                    _update_step_status(state, step_id, "done")
                    state["status"] = "running"
                    save_run_state(state)
                    await run_ctx.emit("checkpoint_resolved", {"step_id": step_id, "action": action})
                    step_03 = next((s for s in steps if s["id"] == "step-03"), None)
                    if step_03:
                        await _run_agent_step(step_03, run_id, state, run_ctx, last_decision)
                    continue

                if action == "request_changes" and step_id == "step-06":
                    # Re-run writer with feedback
                    _update_step_status(state, step_id, "done")
                    state["status"] = "running"
                    save_run_state(state)
                    await run_ctx.emit("checkpoint_resolved", {"step_id": step_id, "action": action})
                    step_05 = next((s for s in steps if s["id"] == "step-05"), None)
                    if step_05:
                        await _run_agent_step(step_05, run_id, state, run_ctx, last_decision)
                    continue

                if action == "adjust_design" and step_id == "step-10":
                    # Re-run designer
                    _update_step_status(state, step_id, "done")
                    state["status"] = "running"
                    save_run_state(state)
                    await run_ctx.emit("checkpoint_resolved", {"step_id": step_id, "action": action})
                    step_09 = next((s for s in steps if s["id"] == "step-09"), None)
                    if step_09:
                        await _run_agent_step(step_09, run_id, state, run_ctx, last_decision)
                    continue

                _update_step_status(state, step_id, "done")
                state["status"] = "running"
                save_run_state(state)
                await run_ctx.emit("checkpoint_resolved", {"step_id": step_id, "action": action})

            # ─────────────────────────────────────────
            #  AGENT STEP
            # ─────────────────────────────────────────
            elif step_type == "agent":
                await _run_agent_step(step, run_id, state, run_ctx, last_decision)

        # Pipeline finished normally
        state["status"] = "completed"
        state["updated_at"] = now_iso()
        save_run_state(state)

        await run_ctx.emit("run_complete", {
            "run_id": run_id,
            "status": "completed",
            "message": "Pipeline concluído com sucesso!"
        })

    except asyncio.CancelledError:
        state["status"] = "error"
        state["error"] = "Pipeline cancelado"
        save_run_state(state)
        await run_ctx.emit("run_error", {"error": "Pipeline cancelado pelo usuário"})

    except Exception as e:
        import traceback
        tb = traceback.format_exc()
        state["status"] = "error"
        state["error"] = str(e)
        save_run_state(state)
        await run_ctx.emit("run_error", {"error": str(e), "detail": tb})


async def _run_agent_step(
    step: dict,
    run_id: str,
    state: dict,
    run_ctx: RunContext,
    last_decision: dict | None,
):
    step_id = step["id"]
    step_name = step.get("name", step_id)
    agent_id = step.get("agent", "")

    agents = _agent_lookup(load_squad_yaml())
    agent_info = agents.get(agent_id, {"name": agent_id, "icon": "🤖"})

    _update_step_status(state, step_id, "running")
    save_run_state(state)

    await run_ctx.emit("step_start", {
        "step_id": step_id,
        "step_name": step_name,
        "agent_id": agent_id,
        "agent_name": agent_info["name"],
        "agent_icon": agent_info["icon"],
    })

    async def on_token(token: str):
        await run_ctx.emit("agent_token", {"token": token})

    output = await agent_executor.execute_step(
        step=step,
        run_id=run_id,
        last_decision=last_decision,
        on_token=on_token,
    )

    _update_step_status(state, step_id, "done")
    save_run_state(state)

    await run_ctx.emit("step_done", {
        "step_id": step_id,
        "step_name": step_name,
        "agent_id": agent_id,
    })
