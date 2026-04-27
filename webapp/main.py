"""
Opensquad FastAPI backend.
"""
from __future__ import annotations

import asyncio
import json
import os
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path

import yaml
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from sse_starlette.sse import EventSourceResponse

from core.config import PROJECT_ROOT, STEP_OUTPUT_FILES
from core.file_manager import now_iso
from core.models import RunContext, CheckpointDecision
from core import pipeline_runner

SQUADS_ROOT = PROJECT_ROOT / "squads"
DASHBOARD_DIST = PROJECT_ROOT / "dashboard" / "dist"


# ─────────────────────────────────────────────
# WebSocket manager (real-time office state)
# ─────────────────────────────────────────────

class WSManager:
    def __init__(self) -> None:
        self._clients: list[WebSocket] = []

    async def connect(self, ws: WebSocket) -> None:
        await ws.accept()
        self._clients.append(ws)

    def disconnect(self, ws: WebSocket) -> None:
        self._clients.discard(ws) if hasattr(self._clients, "discard") else None
        if ws in self._clients:
            self._clients.remove(ws)

    async def broadcast(self, msg: dict) -> None:
        data = json.dumps(msg, ensure_ascii=False)
        dead: list[WebSocket] = []
        for ws in list(self._clients):
            try:
                await ws.send_text(data)
            except Exception:
                dead.append(ws)
        for ws in dead:
            if ws in self._clients:
                self._clients.remove(ws)


ws_manager = WSManager()
active_runs: dict[str, RunContext] = {}

# Stores the last pending checkpoint payload per squad (for SSE replay)
pending_checkpoints: dict[str, dict] = {}


# ─────────────────────────────────────────────
# Squad helpers
# ─────────────────────────────────────────────

def discover_squads() -> list[dict]:
    squads: list[dict] = []
    if not SQUADS_ROOT.exists():
        return squads
    for squad_dir in sorted(SQUADS_ROOT.iterdir()):
        yaml_file = squad_dir / "squad.yaml"
        if not yaml_file.exists():
            continue
        try:
            data = yaml.safe_load(yaml_file.read_text(encoding="utf-8"))
            squads.append({
                "code": data.get("code", squad_dir.name),
                "name": data.get("name", squad_dir.name),
                "description": str(data.get("description", "")).strip(),
                "icon": data.get("icon", "🤖"),
                "agents": [
                    {"id": a["id"], "name": a.get("name", a["id"]), "icon": a.get("icon", "🤖")}
                    for a in data.get("agents", [])
                    if isinstance(a, dict)
                ],
            })
        except Exception:
            pass
    return squads


def load_squad_yaml_data(squad_code: str) -> dict:
    path = SQUADS_ROOT / squad_code / "squad.yaml"
    return yaml.safe_load(path.read_text(encoding="utf-8"))


def load_squad_state(squad_code: str) -> dict | None:
    state_file = SQUADS_ROOT / squad_code / "state.json"
    if state_file.exists():
        try:
            return json.loads(state_file.read_text(encoding="utf-8"))
        except Exception:
            return None
    return None


def save_squad_state(squad_code: str, state: dict) -> None:
    state_file = SQUADS_ROOT / squad_code / "state.json"
    state_file.write_text(json.dumps(state, ensure_ascii=False, indent=2), encoding="utf-8")


def list_squad_runs(squad_code: str) -> list[dict]:
    output_dir = SQUADS_ROOT / squad_code / "output"
    if not output_dir.exists():
        return []
    runs: list[dict] = []
    for d in sorted(output_dir.iterdir(), reverse=True):
        if not d.is_dir():
            continue
        state_file = d / "state.json"
        if not state_file.exists():
            continue
        try:
            s = json.loads(state_file.read_text(encoding="utf-8"))
            runs.append({
                "run_id": d.name,
                "status": s.get("status"),
                "started_at": s.get("started_at"),
                "current_step": s.get("current_step"),
                "steps_done": sum(1 for st in s.get("steps", []) if st.get("status") == "done"),
                "steps_total": len(s.get("steps", [])),
            })
        except Exception:
            pass
    return runs


def build_initial_squad_state(squad_code: str) -> dict:
    data = load_squad_yaml_data(squad_code)
    agents_cfg = data.get("agents", [])
    # Layout: 3 columns × N rows
    COLS = 3
    agents = [
        {
            "id": a["id"],
            "name": a.get("name", a["id"]),
            "icon": a.get("icon", "🤖"),
            "status": "idle",
            "deliverTo": None,
            "desk": {"col": (i % COLS) + 1, "row": (i // COLS) + 1},
        }
        for i, a in enumerate(agents_cfg)
    ]
    ts = now_iso()
    return {
        "squad": squad_code,
        "status": "running",
        "step": {"current": 0, "total": 9, "label": "Iniciando..."},
        "agents": agents,
        "handoff": None,
        "startedAt": ts,
        "updatedAt": ts,
    }


def run_state_to_squad_state(run_state: dict, existing_squad_state: dict | None) -> dict:
    squad_code = run_state.get("squad", "")
    steps = run_state.get("steps", [])
    total = len(steps)
    done_count = sum(1 for s in steps if s.get("status") == "done")
    current_step_id = run_state.get("current_step")
    current_step_name = next(
        (s.get("name", s["id"]) for s in steps if s["id"] == current_step_id),
        current_step_id or "",
    )

    agent_status_map: dict[str, str] = {}
    for step in steps:
        agent_id = step.get("agent")
        if not agent_id:
            continue
        step_status = step.get("status", "pending")
        if step_status == "running":
            agent_status_map[agent_id] = "working"
        elif step_status == "waiting":
            agent_status_map[agent_id] = "checkpoint"
        elif step_status == "done" and agent_id not in agent_status_map:
            agent_status_map[agent_id] = "done"

    agents: list[dict] = []
    if existing_squad_state and "agents" in existing_squad_state:
        for a in existing_squad_state["agents"]:
            agents.append({**a, "status": agent_status_map.get(a["id"], "idle")})
    else:
        try:
            data = load_squad_yaml_data(squad_code)
            for i, a in enumerate(data.get("agents", [])):
                agents.append({
                    "id": a["id"],
                    "name": a.get("name", a["id"]),
                    "icon": a.get("icon", "🤖"),
                    "status": agent_status_map.get(a["id"], "idle"),
                    "deliverTo": None,
                    "desk": {"col": i + 1, "row": 1},
                })
        except Exception:
            pass

    status_map = {
        "running": "running",
        "checkpoint": "checkpoint",
        "completed": "completed",
        "error": "idle",
        "saved_draft": "completed",
    }
    squad_status = status_map.get(run_state.get("status", "running"), "running")

    return {
        "squad": squad_code,
        "status": squad_status,
        "step": {"current": done_count, "total": total, "label": current_step_name},
        "agents": agents,
        "handoff": None,
        "startedAt": run_state.get("started_at"),
        "updatedAt": run_state.get("updated_at", now_iso()),
    }


# ─────────────────────────────────────────────
# Pipeline run management
# ─────────────────────────────────────────────

async def run_and_broadcast(squad_code: str, run_id: str, ctx: RunContext) -> None:
    try:
        initial_state = build_initial_squad_state(squad_code)
        save_squad_state(squad_code, initial_state)
        existing_squad_state = initial_state  # always use fresh squad.yaml–derived state
        await ws_manager.broadcast({"type": "SQUAD_ACTIVE", "squad": squad_code, "state": initial_state})

        pipeline_task = asyncio.create_task(pipeline_runner.run_pipeline(run_id, ctx))
        ctx.task = pipeline_task

        while not pipeline_task.done():
            try:
                event = await asyncio.wait_for(ctx.sse_queue.get(), timeout=0.3)
            except asyncio.TimeoutError:
                continue
            await _handle_pipeline_event(squad_code, run_id, event, existing_squad_state)

        while not ctx.sse_queue.empty():
            event = ctx.sse_queue.get_nowait()
            await _handle_pipeline_event(squad_code, run_id, event, existing_squad_state)

        try:
            pipeline_task.result()
        except (asyncio.CancelledError, Exception):
            pass

    finally:
        active_runs.pop(squad_code, None)
        final_state = load_squad_state(squad_code)
        if final_state:
            await ws_manager.broadcast({"type": "SQUAD_UPDATE", "squad": squad_code, "state": final_state})


async def _handle_pipeline_event(
    squad_code: str,
    run_id: str,
    event: dict,
    existing_squad_state: dict | None,
) -> None:
    evt_type = event.get("event")

    # Track pending checkpoints for SSE replay
    if evt_type == "checkpoint":
        pending_checkpoints[squad_code] = event.get("data", {})
    elif evt_type in ("checkpoint_resolved", "run_complete", "run_error"):
        pending_checkpoints.pop(squad_code, None)

    if evt_type in (
        "step_start", "step_done", "checkpoint",
        "checkpoint_resolved", "run_complete", "run_error",
    ):
        run_state_path = SQUADS_ROOT / squad_code / "output" / run_id / "state.json"
        if run_state_path.exists():
            try:
                run_state = json.loads(run_state_path.read_text(encoding="utf-8"))
                squad_state = run_state_to_squad_state(run_state, existing_squad_state)
                save_squad_state(squad_code, squad_state)
                await ws_manager.broadcast({"type": "SQUAD_UPDATE", "squad": squad_code, "state": squad_state})
            except Exception as exc:
                print(f"[squad-ws] state conversion error: {exc}")


# ─────────────────────────────────────────────
# App
# ─────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    yield


app = FastAPI(title="Opensquad API", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─────────────────────────────────────────────
# WebSocket (office state sync)
# ─────────────────────────────────────────────

@app.websocket("/__squads_ws")
async def squad_ws(websocket: WebSocket):
    await ws_manager.connect(websocket)
    squads = discover_squads()
    active_states: dict[str, dict] = {}
    for sq in squads:
        state = load_squad_state(sq["code"])
        if state:
            active_states[sq["code"]] = state

    await websocket.send_text(json.dumps({
        "type": "SNAPSHOT",
        "squads": squads,
        "activeStates": active_states,
    }))

    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)


# ─────────────────────────────────────────────
# REST — Auth status
# ─────────────────────────────────────────────

@app.get("/api/auth/status")
async def auth_status():
    from core.agent_executor import ANTHROPIC_API_KEY
    if ANTHROPIC_API_KEY:
        masked = ANTHROPIC_API_KEY[:10] + "..." + ANTHROPIC_API_KEY[-4:]
        return {"mode": "api_key", "pinned": True, "key_preview": masked}
    import subprocess
    try:
        result = subprocess.run(
            ["claude", "auth", "status", "--json"],
            capture_output=True, text=True, timeout=5
        )
        data = json.loads(result.stdout) if result.stdout.strip() else {}
        return {"mode": "oauth", "pinned": False, **data}
    except Exception:
        return {"mode": "oauth", "pinned": False, "loggedIn": False}


# ─────────────────────────────────────────────
# REST — Squads
# ─────────────────────────────────────────────

@app.get("/api/squads")
async def get_squads():
    squads = discover_squads()
    result = []
    for sq in squads:
        state = load_squad_state(sq["code"])
        result.append({
            **sq,
            "state": state,
            "isRunning": sq["code"] in active_runs,
        })
    return result


@app.get("/api/squads/{squad_code}")
async def get_squad(squad_code: str):
    if not (SQUADS_ROOT / squad_code).exists():
        return JSONResponse({"error": "Squad not found"}, status_code=404)
    try:
        data = load_squad_yaml_data(squad_code)
    except Exception:
        return JSONResponse({"error": "Failed to load squad config"}, status_code=500)

    return {
        "code": squad_code,
        "name": data.get("name"),
        "description": str(data.get("description", "")).strip(),
        "icon": data.get("icon"),
        "agents": data.get("agents", []),
        "state": load_squad_state(squad_code),
        "isRunning": squad_code in active_runs,
        "recentRuns": list_squad_runs(squad_code)[:5],
    }


@app.post("/api/squads/{squad_code}/run")
async def start_squad_run(squad_code: str):
    if squad_code in active_runs:
        return JSONResponse({"error": "Squad already running"}, status_code=409)
    if not (SQUADS_ROOT / squad_code).exists():
        return JSONResponse({"error": "Squad not found"}, status_code=404)

    # Clear any leftover stop signal
    stop_signal = SQUADS_ROOT / squad_code / ".stop_signal"
    if stop_signal.exists():
        stop_signal.unlink()

    run_id = f"run-{datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S')}"
    ctx = RunContext(run_id=run_id, checkpoint_event=asyncio.Event())
    active_runs[squad_code] = ctx

    asyncio.create_task(run_and_broadcast(squad_code, run_id, ctx))
    return {"run_id": run_id, "squad": squad_code, "status": "started"}


@app.post("/api/squads/{squad_code}/stop")
async def stop_squad_run(squad_code: str):
    # Cancel in-process task and wait for it to actually finish.
    # We must await the task before writing the final state, otherwise
    # the pipeline coroutine may still be executing its CancelledError
    # handler and could overwrite our state.json with status=error.
    ctx = active_runs.pop(squad_code, None)
    if ctx:
        if ctx.task and not ctx.task.done():
            ctx.task.cancel()
            try:
                # Bounded wait so a stuck task can't hang the stop endpoint.
                # The pipeline only awaits on asyncio.Event (checkpoints),
                # asyncio.sleep, or the Anthropic stream — all of which
                # respond to CancelledError immediately.
                await asyncio.wait_for(ctx.task, timeout=5.0)
            except (asyncio.CancelledError, asyncio.TimeoutError, Exception):
                pass
        try:
            await ctx.emit("run_error", {"error": "Squad parado pelo usuário"})
        except Exception:
            pass

    # Write stop signal file (for externally-started pipelines)
    stop_signal = SQUADS_ROOT / squad_code / ".stop_signal"
    stop_signal.write_text("stop", encoding="utf-8")

    # Now that the task has exited, set the authoritative final state.
    state = load_squad_state(squad_code)
    if state:
        for a in state.get("agents", []):
            a["status"] = "idle"
        state["status"] = "idle"
        state["error"] = None
        state["updatedAt"] = now_iso()
        save_squad_state(squad_code, state)
        await ws_manager.broadcast({"type": "SQUAD_UPDATE", "squad": squad_code, "state": state})

    return {"status": "stopped"}


# ─────────────────────────────────────────────
# SSE — real-time event stream
# ─────────────────────────────────────────────

@app.get("/api/squads/{squad_code}/stream")
async def stream_squad_events(squad_code: str, request: Request):
    ctx = active_runs.get(squad_code)

    async def generator():
        yield {"event": "connected", "data": json.dumps({"squad": squad_code, "hasRun": ctx is not None})}

        if not ctx:
            return

        q = ctx.subscribe()
        try:
            # Replay pending checkpoint — always rebuild payload from disk
            # so that any stale/empty payloads get the latest artifact data
            pending = pending_checkpoints.get(squad_code)
            if pending:
                step_id = pending.get("step_id")
                if step_id:
                    try:
                        from core.checkpoint_handler import build_payload
                        rebuilt = build_payload(step_id, ctx.run_id)
                        rebuilt["step_id"] = step_id
                        rebuilt["step_name"] = pending.get("step_name", step_id)
                        pending = rebuilt
                        pending_checkpoints[squad_code] = pending
                    except Exception:
                        pass
                yield {
                    "event": "checkpoint",
                    "data": json.dumps(pending, ensure_ascii=False),
                }

            while True:
                if await request.is_disconnected():
                    break
                try:
                    event = await asyncio.wait_for(q.get(), timeout=15.0)
                    yield {
                        "event": event["event"],
                        "data": json.dumps(event["data"], ensure_ascii=False),
                    }
                    if event["event"] in ("run_complete", "run_error"):
                        break
                except asyncio.TimeoutError:
                    yield {"event": "ping", "data": "{}"}
        finally:
            ctx.unsubscribe(q)

    return EventSourceResponse(generator())


@app.get("/api/squads/{squad_code}/pending")
async def get_pending_state(squad_code: str):
    """Returns current run status + any pending checkpoint payload (rebuilt from disk)."""
    ctx = active_runs.get(squad_code)
    state = load_squad_state(squad_code)
    checkpoint = pending_checkpoints.get(squad_code)

    # Rebuild payload from disk so stale/empty payloads get fresh artifact data
    if checkpoint and ctx:
        step_id = checkpoint.get("step_id")
        if step_id:
            try:
                from core.checkpoint_handler import build_payload
                rebuilt = build_payload(step_id, ctx.run_id)
                rebuilt["step_id"] = step_id
                rebuilt["step_name"] = checkpoint.get("step_name", step_id)
                checkpoint = rebuilt
                pending_checkpoints[squad_code] = checkpoint
            except Exception:
                pass

    return {
        "isRunning": ctx is not None,
        "status": state.get("status") if state else "idle",
        "step": state.get("step") if state else None,
        "pendingCheckpoint": checkpoint,
    }


# ─────────────────────────────────────────────
# Checkpoint approval
# ─────────────────────────────────────────────

@app.post("/api/squads/{squad_code}/checkpoint")
async def submit_checkpoint(squad_code: str, decision: CheckpointDecision):
    ctx = active_runs.get(squad_code)
    if not ctx:
        return JSONResponse({"error": "Nenhuma run ativa para este squad"}, status_code=404)

    ctx.checkpoint_decision = decision.model_dump()
    ctx.checkpoint_event.set()
    return {"status": "ok", "action": decision.action}


# ─────────────────────────────────────────────
# REST — Runs & Metrics
# ─────────────────────────────────────────────

@app.get("/api/squads/{squad_code}/runs")
async def get_squad_runs(squad_code: str):
    if not (SQUADS_ROOT / squad_code).exists():
        return JSONResponse({"error": "Squad not found"}, status_code=404)
    return list_squad_runs(squad_code)


@app.get("/api/squads/{squad_code}/metrics")
async def get_squad_metrics(squad_code: str):
    runs = list_squad_runs(squad_code)
    total = len(runs)
    completed = sum(1 for r in runs if r["status"] in ("completed", "saved_draft"))
    today = datetime.now(timezone.utc).strftime("%Y%m%d")
    today_runs = sum(
        1 for r in runs
        if (r.get("started_at") or "").replace("-", "").replace("T", "").startswith(today.replace("-", ""))
    )
    avg_steps = round(sum(r["steps_done"] for r in runs) / len(runs), 1) if runs else 0.0

    return {
        "total_runs": total,
        "completed_runs": completed,
        "today_runs": today_runs,
        "approval_rate": round(completed / total * 100) if total > 0 else 0,
        "avg_steps_per_run": avg_steps,
        "is_running": squad_code in active_runs,
    }


# ─────────────────────────────────────────────
# REST — Agent details
# ─────────────────────────────────────────────

@app.get("/api/squads/{squad_code}/agents/{agent_id}")
async def get_agent_details(squad_code: str, agent_id: str):
    agent_file = SQUADS_ROOT / squad_code / "agents" / f"{agent_id}.agent.md"
    if not agent_file.exists():
        return JSONResponse({"error": "Agent not found"}, status_code=404)

    import frontmatter
    post = frontmatter.load(str(agent_file))

    squad_state = load_squad_state(squad_code)
    current_status = "idle"
    if squad_state:
        for a in squad_state.get("agents", []):
            if a["id"] == agent_id:
                current_status = a.get("status", "idle")
                break

    runs = list_squad_runs(squad_code)
    recent_activity: list[dict] = []
    latest_outputs: list[dict] = []

    for i, run in enumerate(runs[:10]):
        run_dir = SQUADS_ROOT / squad_code / "output" / run["run_id"]
        state_file = run_dir / "state.json"
        if not state_file.exists():
            continue
        try:
            run_state = json.loads(state_file.read_text(encoding="utf-8"))
            agent_steps = [
                s for s in run_state.get("steps", [])
                if s.get("agent") == agent_id and s.get("status") == "done"
            ]
            if agent_steps:
                recent_activity.append({
                    "run_id": run["run_id"],
                    "started_at": run["started_at"],
                    "steps_completed": [s.get("name", s["id"]) for s in agent_steps],
                    "run_status": run["status"],
                })
            if i == 0 and agent_steps:
                for step in agent_steps:
                    step_id = step["id"]
                    for rel_path in STEP_OUTPUT_FILES.get(step_id, []):
                        output_path = run_dir / rel_path
                        if output_path.exists():
                            try:
                                latest_outputs.append({
                                    "file": rel_path,
                                    "content": output_path.read_text(encoding="utf-8")[:4000],
                                    "step": step_id,
                                })
                            except Exception:
                                pass
        except Exception:
            pass

    return {
        "id": agent_id,
        "name": post.metadata.get("name", agent_id),
        "icon": post.metadata.get("icon", "🤖"),
        "status": current_status,
        "role": post.metadata.get("role", ""),
        "skills": post.metadata.get("skills", []),
        "model_tier": post.metadata.get("model_tier", "standard"),
        "description": (post.content or "").strip()[:1000],
        "recentActivity": recent_activity[:5],
        "latestOutputs": latest_outputs,
    }


# ─────────────────────────────────────────────
# Serve squad output files (images, etc.)
# ─────────────────────────────────────────────

SQUADS_OUTPUT_DIR = SQUADS_ROOT
if SQUADS_OUTPUT_DIR.exists():
    app.mount("/squad-output", StaticFiles(directory=str(SQUADS_OUTPUT_DIR)), name="squad-output")

# ─────────────────────────────────────────────
# Serve built dashboard (production)
# ─────────────────────────────────────────────

if DASHBOARD_DIST.exists():
    app.mount("/", StaticFiles(directory=str(DASHBOARD_DIST), html=True), name="static")


if __name__ == "__main__":
    import uvicorn
    # reload disabled by default — auto-reload kills any in-flight pipeline run
    # because it restarts the whole process. Set OPENSQUAD_RELOAD=1 to opt back in
    # when you're not running a squad.
    reload = os.getenv("OPENSQUAD_RELOAD") == "1"
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=reload)
