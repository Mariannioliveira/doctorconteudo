from pydantic import BaseModel
from typing import Any, Optional, Literal
from dataclasses import dataclass, field
import asyncio


class RunCreate(BaseModel):
    squad: str = "conteudo-social-medicos"


class StepInfo(BaseModel):
    id: str
    name: str
    type: Literal["checkpoint", "agent"]
    agent: Optional[str] = None
    agent_name: Optional[str] = None
    agent_icon: Optional[str] = None
    status: Literal["pending", "running", "done", "waiting", "skipped"] = "pending"


class RunState(BaseModel):
    run_id: str
    squad: str
    status: Literal["running", "checkpoint", "completed", "error", "saved_draft"]
    current_step: Optional[str] = None
    steps: list[StepInfo] = []
    started_at: str
    updated_at: str
    error: Optional[str] = None


class CheckpointDecision(BaseModel):
    step_id: str
    action: str
    value: Optional[Any] = None
    feedback: Optional[str] = None


class RunListItem(BaseModel):
    run_id: str
    squad: str
    status: str
    started_at: str
    current_step: Optional[str] = None


@dataclass
class RunContext:
    run_id: str
    checkpoint_event: asyncio.Event
    checkpoint_decision: Optional[dict] = None
    sse_queue: asyncio.Queue = field(default_factory=asyncio.Queue)
    # Subscriber queues for SSE streaming (multiple clients)
    subscriber_queues: list = field(default_factory=list)
    task: Optional[asyncio.Task] = None

    async def emit(self, event_type: str, data: dict):
        msg = {"event": event_type, "data": data}
        await self.sse_queue.put(msg)
        # Also broadcast to all SSE subscribers
        for q in list(self.subscriber_queues):
            try:
                q.put_nowait(msg)
            except Exception:
                pass

    def subscribe(self) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue(maxsize=500)
        self.subscriber_queues.append(q)
        return q

    def unsubscribe(self, q: asyncio.Queue) -> None:
        try:
            self.subscriber_queues.remove(q)
        except ValueError:
            pass
