"""
In-memory registry of active RunContext objects.
Keyed by run_id. Persists for the lifetime of the process.
"""
from .models import RunContext

_runs: dict[str, RunContext] = {}


def get(run_id: str) -> RunContext | None:
    return _runs.get(run_id)


def put(run_id: str, ctx: RunContext) -> None:
    _runs[run_id] = ctx


def remove(run_id: str) -> None:
    _runs.pop(run_id, None)


def all_contexts() -> dict[str, RunContext]:
    return dict(_runs)
