"""Background asyncio scheduler for scheduled Instagram posts."""
import asyncio
import re
from datetime import datetime, timezone

from . import scheduled_posts as sp


async def scheduler_loop() -> None:
    """Polls every 60 s and publishes due scheduled posts."""
    while True:
        await asyncio.sleep(60)
        try:
            due = sp.get_pending_due()
            for post in due:
                asyncio.create_task(fire_post(post["id"]))
        except Exception as e:
            print(f"[scheduler] loop error: {e}")


async def fire_post(post_id: str) -> None:
    """Publish a single scheduled post. Called by the loop and by the manual-trigger endpoint."""
    from . import agent_executor
    from pathlib import Path

    post = sp.get_by_id(post_id)
    if not post or post["status"] not in ("pending", "running"):
        return

    sp.update_status(post_id, "running")
    try:
        image_path = Path(post["image_path"])
        if not image_path.exists():
            sp.update_status(post_id, "failed", error=f"Imagem não encontrada: {image_path}")
            return

        output = await agent_executor._execute_scheduled_post(
            image_path=str(image_path),
            caption=post["caption"],
            run_id=post["run_id"],
        )

        if "PUBLICADO" in output or "Post ID:" in output:
            post_id_m = re.search(r"Post ID:\s*(\S+)", output)
            url_m = re.search(r"URL:\s*(\S+)", output)
            sp.update_status(
                post_id,
                "published",
                instagram_post_id=post_id_m.group(1) if post_id_m else None,
                instagram_url=url_m.group(1) if url_m else None,
                published_at=datetime.now(timezone.utc).isoformat(),
            )
            print(f"[scheduler] post {post_id[:8]}… publicado")
        else:
            sp.update_status(post_id, "failed", error=output[:500])
            print(f"[scheduler] post {post_id[:8]}… falhou: {output[:200]}")

    except Exception as e:
        sp.update_status(post_id, "failed", error=str(e))
        print(f"[scheduler] post {post_id[:8]}… erro: {e}")
