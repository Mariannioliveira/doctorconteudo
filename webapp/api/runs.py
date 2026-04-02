"""
Run management endpoints:
  POST /api/runs            — start a new pipeline run
  GET  /api/runs            — list all runs (from filesystem)
  GET  /api/runs/{run_id}   — get run state
  POST /api/runs/{run_id}/checkpoint — submit checkpoint decision
  GET  /api/runs/{run_id}/stream    — SSE event stream
  GET  /api/runs/{run_id}/artifacts/{path} — serve artifact file
"""
import asyncio
import json
import uuid
from pathlib import Path

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import FileResponse
from sse_starlette.sse import EventSourceResponse

from ..core.models import RunCreate, CheckpointDecision, RunContext
from ..core.file_manager import (
    list_runs, load_run_state, get_run_dir, init_run_dir
)
from ..core import pipeline_runner
from ..core import registry

router = APIRouter(tags=["runs"])


# ─────────────────────────────────────────────
#  List runs
# ─────────────────────────────────────────────

@router.get("/runs")
async def get_runs():
    return {"runs": list_runs()}


# ─────────────────────────────────────────────
#  Start a new run
# ─────────────────────────────────────────────

@router.post("/runs", status_code=201)
async def create_run(body: RunCreate):
    run_id = f"run-{uuid.uuid4().hex[:8]}"
    init_run_dir(run_id)

    ctx = RunContext(
        run_id=run_id,
        checkpoint_event=asyncio.Event(),
    )
    registry.put(run_id, ctx)

    async def _task():
        try:
            await pipeline_runner.run_pipeline(run_id, ctx)
        finally:
            # Keep context alive so SSE clients can drain the queue
            pass

    ctx.task = asyncio.create_task(_task())

    return {
        "run_id": run_id,
        "squad": body.squad,
        "status": "running",
    }


# ─────────────────────────────────────────────
#  Get run state
# ─────────────────────────────────────────────

@router.get("/runs/{run_id}")
async def get_run(run_id: str):
    state = load_run_state(run_id)
    if not state:
        raise HTTPException(404, "Run not found")
    return state


# ─────────────────────────────────────────────
#  Submit checkpoint decision
# ─────────────────────────────────────────────

@router.post("/runs/{run_id}/checkpoint")
async def submit_checkpoint(run_id: str, decision: CheckpointDecision):
    ctx = registry.get(run_id)
    if not ctx:
        raise HTTPException(404, "Run not active or already completed")

    ctx.checkpoint_decision = decision.model_dump()
    ctx.checkpoint_event.set()
    return {"ok": True}


# ─────────────────────────────────────────────
#  SSE stream
# ─────────────────────────────────────────────

@router.get("/runs/{run_id}/stream")
async def stream_run(run_id: str, request: Request):
    ctx = registry.get(run_id)
    if not ctx:
        # Try to return a completed/error stub if the run exists on disk
        state = load_run_state(run_id)
        if not state:
            raise HTTPException(404, "Run not found")
        # Run already finished — send its final status and close
        final_status = state.get("status", "completed")

        async def _done_stream():
            yield {
                "event": "run_complete",
                "data": json.dumps({"run_id": run_id, "status": final_status, "message": ""}),
            }

        return EventSourceResponse(_done_stream())

    async def _event_stream():
        while True:
            if await request.is_disconnected():
                break
            try:
                event = await asyncio.wait_for(ctx.sse_queue.get(), timeout=20)
                yield {
                    "event": event["event"],
                    "data": json.dumps(event["data"], ensure_ascii=False),
                }
                # Stop streaming once the run reaches a terminal event
                if event["event"] in ("run_complete", "run_error"):
                    break
            except asyncio.TimeoutError:
                yield {"event": "ping", "data": "{}"}

    return EventSourceResponse(_event_stream())


# ─────────────────────────────────────────────
#  Serve artifact file (design images, markdown, etc.)
# ─────────────────────────────────────────────

@router.get("/runs/{run_id}/artifacts/{file_path:path}")
async def get_artifact(run_id: str, file_path: str):
    run_dir = get_run_dir(run_id)
    target = (run_dir / file_path).resolve()

    # Security: reject path traversal
    try:
        target.relative_to(run_dir.resolve())
    except ValueError:
        raise HTTPException(403, "Forbidden")

    if not target.exists():
        raise HTTPException(404, "Artifact not found")

    return FileResponse(str(target))
