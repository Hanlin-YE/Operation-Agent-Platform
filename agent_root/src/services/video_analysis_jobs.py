"""Durable, local task records for the video reference-analysis pipeline."""
from __future__ import annotations

import json
import os
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class VideoAnalysisJobStore:
    """Small JSON store: artifacts are reviewable; source video files never are."""

    def __init__(self, path: Path | None = None) -> None:
        configured = os.getenv("VIDEO_ANALYSIS_JOB_STORE_PATH", "").strip()
        self.path = path or Path(configured or "data/video-analysis-jobs.json")
        self._lock = threading.Lock()
        self._jobs: dict[str, dict[str, Any]] = {}
        self._load()

    def _load(self) -> None:
        try:
            raw = json.loads(self.path.read_text(encoding="utf-8"))
            self._jobs = raw.get("jobs", {}) if isinstance(raw, dict) else {}
        except (FileNotFoundError, json.JSONDecodeError):
            self._jobs = {}
        changed = False
        for job in self._jobs.values():
            if job.get("status") in {"queued", "processing"}:
                job.update({
                    "status": "failed", "step": "任务中断", "percent": int(job.get("percent", 0)),
                    "message": "Agent 服务重启，未完成的视频拉片任务已停止。请重新提交。",
                    "error": {"code": "agent_restarted", "message": "Agent 服务重启，未完成的视频拉片任务已停止。请重新提交。"},
                    "updatedAt": _now(), "finishedAt": _now(),
                })
                job.setdefault("logs", []).append({"at": _now(), "level": "error", "message": job["message"]})
                changed = True
        if changed:
            self._persist()

    def _persist(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        temporary = self.path.with_suffix(f"{self.path.suffix}.tmp")
        temporary.write_text(json.dumps({"jobs": self._jobs}, ensure_ascii=False, indent=2), encoding="utf-8")
        temporary.replace(self.path)

    def create(self, source: dict[str, Any]) -> dict[str, Any]:
        with self._lock:
            now = _now()
            job_id = f"video-{uuid.uuid4().hex[:12]}"
            job = {
                "jobId": job_id, "status": "queued", "step": "等待队列", "percent": 0,
                "message": "任务已创建，等待开始处理。", "source": source,
                "transcript": [], "scenes": [], "warnings": [], "logs": [{"at": now, "level": "info", "message": "任务已进入队列。"}],
                "createdAt": now, "updatedAt": now,
            }
            self._jobs[job_id] = job
            self._persist()
            return dict(job)

    def get(self, job_id: str) -> dict[str, Any] | None:
        with self._lock:
            job = self._jobs.get(job_id)
            return json.loads(json.dumps(job, ensure_ascii=False)) if job else None

    def find_completed_by_source_url(self, source_url: str) -> dict[str, Any] | None:
        normalized = source_url.strip()
        with self._lock:
            matches = [
                job for job in self._jobs.values()
                if job.get("status") == "needs_review"
                and str(job.get("source", {}).get("sourceUrl", "")).strip() == normalized
                and job.get("script")
            ]
            if not matches:
                return None
            latest = max(matches, key=lambda job: str(job.get("updatedAt", "")))
            return json.loads(json.dumps(latest, ensure_ascii=False))

    def update(self, job_id: str, *, status: str | None = None, step: str | None = None,
               percent: int | None = None, message: str | None = None, log_level: str = "info",
               error: dict[str, str] | None = None, **fields: Any) -> dict[str, Any]:
        with self._lock:
            job = self._jobs[job_id]
            for key, value in fields.items():
                if value is not None:
                    job[key] = value
            if status is not None:
                job["status"] = status
            if step is not None:
                job["step"] = step
            if percent is not None:
                job["percent"] = max(0, min(100, percent))
            if message is not None:
                job["message"] = message
                job.setdefault("logs", []).append({"at": _now(), "level": log_level, "message": message})
            if error is not None:
                job["error"] = error
            elif status in {"needs_review", "model_not_configured"}:
                job.pop("error", None)
            if status in {"needs_review", "model_not_configured", "failed"}:
                job["finishedAt"] = _now()
            job["updatedAt"] = _now()
            self._persist()
            return json.loads(json.dumps(job, ensure_ascii=False))
