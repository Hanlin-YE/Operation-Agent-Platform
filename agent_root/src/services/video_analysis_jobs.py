"""SQLite-backed video job records. Source videos live in local directories."""
from __future__ import annotations
import json
import os
import shutil
import sqlite3
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class VideoAnalysisJobStore:
    def __init__(self, path: Path | None = None) -> None:
        configured = os.getenv("VIDEO_ANALYSIS_JOB_STORE_PATH", "").strip()
        legacy = path or Path(configured or "data/video-analysis-jobs.json")
        self.path = legacy.with_suffix(".sqlite") if legacy.suffix == ".json" else legacy
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.source_directory = self.path.parent / "video-sources"
        with self._connect() as db:
            db.execute("PRAGMA journal_mode=WAL")
            db.execute("CREATE TABLE IF NOT EXISTS jobs(id TEXT PRIMARY KEY, payload TEXT NOT NULL, dedupe TEXT UNIQUE, owner_pid INTEGER)")
            db.execute("CREATE TABLE IF NOT EXISTS migrations(name TEXT PRIMARY KEY)")
            if not db.execute("SELECT 1 FROM migrations WHERE name='json'").fetchone():
                if legacy.suffix == ".json" and legacy.exists():
                    raw = json.loads(legacy.read_text(encoding="utf-8"))
                    if not isinstance(raw.get("jobs"), dict):
                        raise ValueError("旧视频任务数据格式无效")
                    backup = Path(str(legacy) + ".pre-sqlite.bak")
                    if not backup.exists():
                        shutil.copy2(legacy, backup)
                        backup.chmod(0o600)
                    for job_id, job in raw["jobs"].items():
                        db.execute("INSERT OR IGNORE INTO jobs VALUES(?,?,NULL,NULL)", (job_id, json.dumps(job, ensure_ascii=False)))
                db.execute("INSERT INTO migrations VALUES('json')")
            for job_id, payload, owner_pid in db.execute("SELECT id,payload,owner_pid FROM jobs").fetchall():
                job = json.loads(payload)
                alive = False
                if owner_pid:
                    try:
                        os.kill(owner_pid, 0)
                        alive = True
                    except ProcessLookupError:
                        pass
                    except PermissionError:
                        alive = True
                if job.get("status") in {"queued", "processing"} and not alive:
                    message = "Agent 服务重启，任务已中断。原始输入已保留，可从任务中心重试。"
                    job.update(status="interrupted", step="任务中断", message=message, error={"code": "agent_restarted", "message": message}, updatedAt=_now(), finishedAt=_now())
                    db.execute("UPDATE jobs SET payload=? WHERE id=?", (json.dumps(job, ensure_ascii=False), job_id))
        self.path.chmod(0o600)

    @contextmanager
    def _connect(self):
        db = sqlite3.connect(self.path, timeout=10)
        db.execute("PRAGMA synchronous=FULL")
        try:
            with db:
                yield db
        finally:
            db.close()

    def create(self, source: dict[str, Any], dedupe: str | None = None, model: dict | None = None) -> dict[str, Any]:
        now = _now()
        job_id = f"video-{uuid.uuid4().hex[:12]}"
        job = {"jobId": job_id, "status": "queued", "step": "等待队列", "percent": 0,
               "message": "任务已创建，等待开始处理。", "source": source, "model": model,
               "transcript": [], "scenes": [], "warnings": [], "logs": [{"at": now, "level": "info", "message": "任务已进入队列。"}],
               "createdAt": now, "updatedAt": now}
        with self._connect() as db:
            db.execute("BEGIN IMMEDIATE")
            if dedupe:
                existing = db.execute("SELECT payload FROM jobs WHERE dedupe=?", (dedupe,)).fetchone()
                if existing:
                    return json.loads(existing[0])
            db.execute("INSERT INTO jobs VALUES(?,?,?,?)", (job_id, json.dumps(job, ensure_ascii=False), dedupe, os.getpid()))
        return job

    def claim(self, job_id: str) -> bool:
        with self._connect() as db:
            db.execute("BEGIN IMMEDIATE")
            row = db.execute("SELECT payload FROM jobs WHERE id=?", (job_id,)).fetchone()
            if not row:
                return False
            job = json.loads(row[0])
            if job["status"] != "queued":
                return False
            job["status"] = "processing"
            db.execute("UPDATE jobs SET payload=?,owner_pid=? WHERE id=?", (json.dumps(job, ensure_ascii=False), os.getpid(), job_id))
            return True

    def get(self, job_id: str) -> dict[str, Any] | None:
        with self._connect() as db:
            row = db.execute("SELECT payload FROM jobs WHERE id=?", (job_id,)).fetchone()
            return json.loads(row[0]) if row else None

    def find_completed_by_source_url(self, source_url: str) -> dict[str, Any] | None:
        with self._connect() as db:
            jobs = [json.loads(row[0]) for row in db.execute("SELECT payload FROM jobs")]
        matches = [job for job in jobs if job.get("status") == "needs_review" and job.get("source", {}).get("sourceUrl", "").strip() == source_url.strip() and job.get("script")]
        return max(matches, key=lambda job: str(job.get("updatedAt", ""))) if matches else None

    def update(self, job_id: str, *, status: str | None = None, step: str | None = None,
               percent: int | None = None, message: str | None = None, log_level: str = "info",
               error: dict[str, str] | None = None, **fields: Any) -> dict[str, Any]:
        with self._connect() as db:
            db.execute("BEGIN IMMEDIATE")
            row = db.execute("SELECT payload FROM jobs WHERE id=?", (job_id,)).fetchone()
            if not row:
                raise KeyError(job_id)
            job = json.loads(row[0])
            job.update({key: value for key, value in fields.items() if value is not None})
            if status is not None: job["status"] = status
            if step is not None: job["step"] = step
            if percent is not None: job["percent"] = max(0, min(100, percent))
            if message is not None:
                job["message"] = message
                job.setdefault("logs", []).append({"at": _now(), "level": log_level, "message": message})
            if error is not None: job["error"] = error
            elif status in {"needs_review", "model_not_configured"}: job.pop("error", None)
            if status in {"needs_review", "model_not_configured", "failed", "interrupted"}: job["finishedAt"] = _now()
            job["updatedAt"] = _now()
            db.execute("UPDATE jobs SET payload=? WHERE id=?", (json.dumps(job, ensure_ascii=False), job_id))
            return job
