"""
Central pipeline orchestrator.
Runs steps in sequence, pausing at checkpoints via asyncio.Event.
Emits SSE events via RunContext.sse_queue.
"""
import asyncio
import yaml
from datetime import datetime, timezone

from .models import RunContext, StepInfo
from .config import SQUAD_ROOT, PROJECT_ROOT
from .file_manager import (
    load_pipeline_yaml, load_squad_yaml,
    save_run_state, save_checkpoint_decision,
    now_iso, get_run_dir
)
from .checkpoint_handler import build_payload
from . import agent_executor


def _slugify(text: str, max_len: int = 60) -> str:
    import re, unicodedata
    norm = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode("ascii")
    norm = re.sub(r"[^a-zA-Z0-9]+", "-", norm).strip("-").lower()
    return (norm or "card")[:max_len]


def _download_card_as_png(run_id: str) -> str | None:
    """Convert design/card.jpg → ~/Downloads/{slug}.png. Returns the PNG path or None."""
    import os, shutil, subprocess
    from pathlib import Path
    run_dir = get_run_dir(run_id)
    card_jpg = run_dir / "design" / "card.jpg"
    if not card_jpg.exists():
        return None

    headline = ""
    try:
        from .file_manager import read_artifact
        draft = read_artifact(run_id, "v1/content-draft.md") or ""
        import re
        m = re.search(r"=== HEADLINE DO CARD ===\s*\n(.+)", draft)
        if m:
            headline = m.group(1).strip()
    except Exception:
        pass

    slug = _slugify(headline) if headline else f"card-{run_id}"
    downloads_dir = Path(os.path.expanduser("~/Downloads"))
    downloads_dir.mkdir(parents=True, exist_ok=True)
    dst = downloads_dir / f"doctorcreator-{slug}.png"

    try:
        subprocess.run(
            ["sips", "-s", "format", "png", str(card_jpg), "--out", str(dst)],
            check=True, capture_output=True,
        )
        return str(dst)
    except Exception:
        try:
            shutil.copyfile(card_jpg, dst.with_suffix(".jpg"))
            return str(dst.with_suffix(".jpg"))
        except Exception:
            return None


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

    stop_signal = PROJECT_ROOT / "squads" / squad_yaml.get("code", "conteudo-social-medicos") / ".stop_signal"

    try:
        for step in steps:
            # Check stop signal before each step
            if stop_signal.exists():
                state["status"] = "error"
                state["error"] = "Pipeline parado pelo usuário"
                save_run_state(state)
                await run_ctx.emit("run_error", {"error": "Pipeline parado pelo usuário"})
                return

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

                # step-02: save selected story so Carlos Cópia can read it
                if step_id == "step-02" and action == "select":
                    story_value = decision.get("value")
                    if story_value and isinstance(story_value, dict):
                        run_dir = get_run_dir(run_id)
                        story_yaml = yaml.dump(story_value, allow_unicode=True, default_flow_style=False)
                        (run_dir / "selected-story.yaml").write_text(story_yaml, encoding="utf-8")

                # Terminal: save draft
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

                # Terminal: download card as PNG (step-07)
                if action in ("download", "save") and step_id == "step-07":
                    _update_step_status(state, step_id, "done")
                    state["status"] = "completed"
                    save_run_state(state)
                    download_path = _download_card_as_png(run_id)
                    msg = (
                        f"Imagem baixada para {download_path}"
                        if download_path
                        else "Card salvo (não foi possível copiar para Downloads)."
                    )
                    await run_ctx.emit("run_complete", {
                        "run_id": run_id,
                        "status": "completed",
                        "message": msg,
                    })
                    return

                # step-05: user requests content changes → re-run redator + revisor
                if action == "request_changes" and step_id == "step-05":
                    _update_step_status(state, step_id, "done")
                    state["status"] = "running"
                    save_run_state(state)
                    await run_ctx.emit("checkpoint_resolved", {"step_id": step_id, "action": action})
                    step_03 = next((s for s in steps if s["id"] == "step-03"), None)
                    if step_03:
                        await _run_agent_step(step_03, run_id, state, run_ctx, last_decision)
                    step_04 = next((s for s in steps if s["id"] == "step-04"), None)
                    if step_04:
                        await _run_agent_step(step_04, run_id, state, run_ctx, last_decision)
                    continue

                # step-07: user wants design adjusted → re-run designer and ask again.
                # Loop here until the user picks a terminal action (publish or download/save).
                # Without this loop, control would fall through to step-08 (publish) and
                # bypass approval — exactly what we don't want.
                if action == "adjust_design" and step_id == "step-07":
                    while action == "adjust_design":
                        state["status"] = "running"
                        save_run_state(state)
                        await run_ctx.emit("checkpoint_resolved", {"step_id": step_id, "action": action})

                        step_06 = next((s for s in steps if s["id"] == "step-06"), None)
                        if step_06:
                            await _run_agent_step(step_06, run_id, state, run_ctx, last_decision)

                        _update_step_status(state, step_id, "waiting")
                        state["status"] = "checkpoint"
                        save_run_state(state)
                        payload = build_payload(step_id, run_id)
                        await run_ctx.emit("checkpoint", {
                            "step_id": step_id,
                            "step_name": step_name,
                            **payload,
                        })
                        await run_ctx.checkpoint_event.wait()
                        run_ctx.checkpoint_event.clear()

                        decision = run_ctx.checkpoint_decision or {}
                        last_decision = decision
                        action = decision.get("action", "")
                        save_checkpoint_decision(run_id, step_id, decision)

                    # Terminal: user chose download (or save legacy)
                    if action in ("download", "save"):
                        _update_step_status(state, step_id, "done")
                        state["status"] = "completed"
                        save_run_state(state)
                        download_path = _download_card_as_png(run_id)
                        msg = (
                            f"Imagem baixada para {download_path}"
                            if download_path
                            else "Card salvo (não foi possível copiar para Downloads)."
                        )
                        await run_ctx.emit("run_complete", {
                            "run_id": run_id,
                            "status": "completed",
                            "message": msg,
                        })
                        return

                    # Terminal: user chose publish — fall through to advance to step-08
                    _update_step_status(state, step_id, "done")
                    state["status"] = "running"
                    save_run_state(state)
                    await run_ctx.emit("checkpoint_resolved", {"step_id": step_id, "action": action})
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
        # User clicked Parar. stop_squad_run owns the final state.json write
        # (sets status=idle and broadcasts), so we must NOT overwrite it here
        # with status=error — that would race and end up showing "error" in the UI.
        try:
            await run_ctx.emit("run_error", {"error": "Pipeline parado pelo usuário"})
        except Exception:
            pass
        raise

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

    def on_token(token: str):
        asyncio.create_task(run_ctx.emit("agent_token", {"agent_id": agent_id, "token": token}))

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
        "agent_name": agent_info["name"],
        "agent_icon": agent_info["icon"],
    })
