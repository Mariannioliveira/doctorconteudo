"""
Squad listing endpoints.
"""
from fastapi import APIRouter
from ..core.file_manager import load_squad_yaml, load_pipeline_yaml, list_runs

router = APIRouter(tags=["squads"])


@router.get("/squads")
async def list_squads():
    """Return all available squads with metadata."""
    try:
        squad = load_squad_yaml()
        pipeline = load_pipeline_yaml()
        agents = squad.get("agents", [])
        steps = pipeline.get("steps", [])
        return {
            "squads": [
                {
                    "code": squad.get("code", "conteudo-social-medicos"),
                    "name": squad.get("name", ""),
                    "description": squad.get("description", ""),
                    "icon": squad.get("icon", "🤖"),
                    "agents": [a["id"] for a in agents],
                    "total_steps": len(steps),
                }
            ]
        }
    except Exception as e:
        return {"squads": [], "error": str(e)}
