"""
Opensquad API — FastAPI application entry point.

Start with:
    cd webapp
    uvicorn main:app --reload --port 8000
"""
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .core import registry
from .api import squads, runs


# ─────────────────────────────────────────────
#  Lifespan — cancel pending tasks on shutdown
# ─────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    for ctx in registry.all_contexts().values():
        if ctx.task and not ctx.task.done():
            ctx.task.cancel()


# ─────────────────────────────────────────────
#  App
# ─────────────────────────────────────────────

app = FastAPI(
    title="Opensquad API",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],          # tightened in production via env
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(squads.router, prefix="/api")
app.include_router(runs.router, prefix="/api")


# ─────────────────────────────────────────────
#  Serve built dashboard (production)
# ─────────────────────────────────────────────

_dist = Path(__file__).parent.parent / "dashboard" / "dist"
if _dist.exists():
    app.mount("/", StaticFiles(directory=_dist, html=True), name="static")
