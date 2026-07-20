from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime
from threading import RLock
from typing import Any
from uuid import uuid4

from src.api.schemas import RunLog, RunProgress, RunReview, TaskType
from src.core.run_state import RunStatus, transition_run


class RunNotFoundError(KeyError):
    pass


class RunVersionConflictError(ValueError):
    pass


class RunStateConflictError(ValueError):
    pass


@dataclass
class RunRecord:
    run_id: str
    task_type: TaskType
    params: dict[str, Any]
    idempotency_key: str
    status: RunStatus = RunStatus.PENDING
    version: int = 1
    created_at: datetime = field(default_factory=lambda: datetime.now(UTC))
    updated_at: datetime = field(default_factory=lambda: datetime.now(UTC))
    logs: list[RunLog] = field(default_factory=list)
    material_ids: list[str] = field(default_factory=list)
    collected_items: list[dict[str, Any]] = field(default_factory=list)
    approved_material_ids: list[str] = field(default_factory=list)
    rejected_material_ids: list[str] = field(default_factory=list)
    annotation_started: bool = False
    result: dict[str, Any] | None = None
    error: dict[str, str] | None = None

    def as_detail(self) -> dict[str, Any]:
        progress = {
            RunStatus.PENDING: RunProgress(step="queued", percent=0),
            RunStatus.EXTRACTING: RunProgress(step="extracting", percent=25),
            RunStatus.WAITING_REVIEW: RunProgress(step="review", percent=55),
            RunStatus.ANNOTATING: RunProgress(step="annotating", percent=75),
            RunStatus.SUCCESS: RunProgress(step="complete", percent=100),
            RunStatus.FAILED: RunProgress(step="failed", percent=100),
        }[self.status]
        return {
            "run_id": self.run_id,
            "task_type": self.task_type,
            "status": self.status,
            "version": self.version,
            "lifecycle_state": self.params.get("lifecycle_state"),
            "created_at": self.created_at,
            "updated_at": self.updated_at,
            "progress": progress,
            "logs": self.logs,
            "review": RunReview(
                required=self.status in {RunStatus.WAITING_REVIEW, RunStatus.ANNOTATING},
                approved_count=len(self.approved_material_ids),
                rejected_count=len(self.rejected_material_ids),
                material_ids=self.material_ids,
            ),
            "collected_items": self.collected_items,
            "result": self.result,
            "error": self.error,
        }


class InMemoryDingTalkClient:
    """Development/test control plane with the same record semantics as Base.

    Production wiring replaces this adapter with a DingTalk Control Plane implementation;
    it intentionally contains no credentials or file-backed persistence.
    """

    def __init__(self) -> None:
        self._records: dict[str, RunRecord] = {}
        self._idempotency: dict[str, str] = {}
        self._lock = RLock()

    def create_task_record(self, task_type: TaskType, params: dict[str, Any], idempotency_key: str) -> RunRecord:
        with self._lock:
            if existing_id := self._idempotency.get(idempotency_key):
                return self._records[existing_id]
            run_id = f"run_{uuid4().hex}"
            record = RunRecord(run_id=run_id, task_type=task_type, params=params, idempotency_key=idempotency_key)
            record.logs.append(RunLog(at=record.created_at, level="INFO", event="RUN_CREATED", message="任务已创建，等待执行。"))
            self._records[run_id] = record
            self._idempotency[idempotency_key] = run_id
            return record

    def get_task_record(self, run_id: str) -> RunRecord:
        with self._lock:
            try:
                return self._records[run_id]
            except KeyError as exc:
                raise RunNotFoundError(run_id) from exc

    def claim_pending_run(self) -> RunRecord | None:
        """Atomically claim one pending record for the local development worker."""
        with self._lock:
            pending = next((record for record in self._records.values() if record.status is RunStatus.PENDING), None)
            if not pending:
                return None
            transition_run(pending.status, RunStatus.EXTRACTING)
            pending.status = RunStatus.EXTRACTING
            pending.version += 1
            pending.updated_at = datetime.now(UTC)
            pending.logs.append(RunLog(at=pending.updated_at, level="INFO", event="RUN_CLAIMED", message="任务已由执行器领取。"))
            return pending

    def complete_extraction(self, run_id: str, collected_items: list[dict[str, Any] | str]) -> RunRecord:
        with self._lock:
            record = self.get_task_record(run_id)
            if record.status is not RunStatus.EXTRACTING:
                raise RunStateConflictError(record.status)
            transition_run(record.status, RunStatus.WAITING_REVIEW)
            record.status = RunStatus.WAITING_REVIEW
            record.version += 1
            record.updated_at = datetime.now(UTC)
            normalized_items = [
                item
                if isinstance(item, dict)
                else {"id": item, "title": "新收集信息", "summary": "待审核的结构化素材。", "source": "local-demo"}
                for item in collected_items
            ]
            record.collected_items = normalized_items
            record.material_ids = [str(item["id"]) for item in normalized_items]
            record.logs.append(
                RunLog(
                    at=record.updated_at,
                    level="INFO",
                    event="MATERIAL_EXTRACTED",
                    message=f"已生成 {len(normalized_items)} 条待审核素材。",
                )
            )
            return record

    def claim_annotating_run(self) -> RunRecord | None:
        with self._lock:
            record = next(
                (
                    item
                    for item in self._records.values()
                    if item.status is RunStatus.ANNOTATING and not item.annotation_started
                ),
                None,
            )
            if not record:
                return None
            record.annotation_started = True
            record.version += 1
            record.updated_at = datetime.now(UTC)
            record.logs.append(
                RunLog(
                    at=record.updated_at,
                    level="INFO",
                    event="PROVIDER_STARTED",
                    message="模型 Provider 已领取审核素材。",
                )
            )
            return record

    def complete_annotation(self, run_id: str, result: dict[str, Any]) -> RunRecord:
        with self._lock:
            record = self.get_task_record(run_id)
            if record.status is not RunStatus.ANNOTATING:
                raise RunStateConflictError(record.status)
            transition_run(record.status, RunStatus.SUCCESS)
            record.status = RunStatus.SUCCESS
            record.result = result
            record.error = None
            record.version += 1
            record.updated_at = datetime.now(UTC)
            record.logs.append(
                RunLog(
                    at=record.updated_at,
                    level="INFO",
                    event="PROVIDER_COMPLETED",
                    message=f"模型 Provider {result.get('provider_model', 'unknown')} 已完成处理。",
                )
            )
            return record

    def fail_annotation(self, run_id: str, message: str) -> RunRecord:
        with self._lock:
            record = self.get_task_record(run_id)
            if record.status is not RunStatus.ANNOTATING:
                raise RunStateConflictError(record.status)
            transition_run(record.status, RunStatus.FAILED)
            record.status = RunStatus.FAILED
            record.error = {"code": "PROVIDER_FAILED", "message": message}
            record.version += 1
            record.updated_at = datetime.now(UTC)
            record.logs.append(
                RunLog(at=record.updated_at, level="ERROR", event="PROVIDER_FAILED", message=message)
            )
            return record

    def confirm_materials(
        self,
        run_id: str,
        approved_material_ids: list[str],
        rejected_material_ids: list[str],
        reviewer_id: str,
        comment: str | None,
        expected_version: int,
    ) -> RunRecord:
        with self._lock:
            record = self.get_task_record(run_id)
            if record.version != expected_version:
                raise RunVersionConflictError(run_id)
            if record.status is not RunStatus.WAITING_REVIEW:
                raise RunStateConflictError(record.status)
            if not set(approved_material_ids).issubset(record.material_ids) or not set(rejected_material_ids).issubset(record.material_ids):
                raise ValueError("reviewed material does not belong to this run")
            transition_run(record.status, RunStatus.ANNOTATING)
            record.status = RunStatus.ANNOTATING
            record.version += 1
            record.updated_at = datetime.now(UTC)
            record.approved_material_ids = approved_material_ids
            record.rejected_material_ids = rejected_material_ids
            record.logs.append(
                RunLog(
                    at=record.updated_at,
                    level="INFO",
                    event="MATERIALS_CONFIRMED",
                    message=f"审核人 {reviewer_id} 已确认 {len(approved_material_ids)} 条素材。{comment or ''}",
                )
            )
            return record
