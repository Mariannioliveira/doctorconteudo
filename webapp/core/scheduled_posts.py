"""Persistence layer for scheduled Instagram posts."""
import json
import uuid
from datetime import datetime, timezone
from pathlib import Path

from .config import PROJECT_ROOT

_STORE_PATH = PROJECT_ROOT / "squads" / "_scheduled_posts.json"


def _load() -> list[dict]:
    if _STORE_PATH.exists():
        try:
            return json.loads(_STORE_PATH.read_text(encoding="utf-8"))
        except Exception:
            pass
    return []


def _save(posts: list[dict]) -> None:
    _STORE_PATH.parent.mkdir(parents=True, exist_ok=True)
    _STORE_PATH.write_text(json.dumps(posts, ensure_ascii=False, indent=2), encoding="utf-8")


def add(squad_name: str, run_id: str, image_path: str, caption: str, scheduled_time: str) -> dict:
    posts = _load()
    post = {
        "id": str(uuid.uuid4()),
        "squad_name": squad_name,
        "run_id": run_id,
        "image_path": image_path,
        "caption": caption,
        "scheduled_time": scheduled_time,
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "published_at": None,
        "instagram_post_id": None,
        "instagram_url": None,
        "error": None,
    }
    posts.append(post)
    _save(posts)
    return post


def list_all() -> list[dict]:
    return _load()


def get_by_id(post_id: str) -> dict | None:
    for p in _load():
        if p["id"] == post_id:
            return p
    return None


def cancel(post_id: str) -> bool:
    posts = _load()
    for p in posts:
        if p["id"] == post_id and p["status"] == "pending":
            p["status"] = "cancelled"
            _save(posts)
            return True
    return False


def update_status(post_id: str, status: str, **kwargs) -> None:
    posts = _load()
    for p in posts:
        if p["id"] == post_id:
            p["status"] = status
            for k, v in kwargs.items():
                p[k] = v
            _save(posts)
            return


def get_pending_due() -> list[dict]:
    now = datetime.now(timezone.utc)
    result = []
    for p in _load():
        if p["status"] != "pending":
            continue
        try:
            scheduled = datetime.fromisoformat(p["scheduled_time"])
            if scheduled.tzinfo is None:
                scheduled = scheduled.replace(tzinfo=timezone.utc)
            if scheduled <= now:
                result.append(p)
        except Exception:
            pass
    return result
