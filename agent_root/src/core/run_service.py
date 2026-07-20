from __future__ import annotations

from src.api.schemas import RunConfirmRequest, RunCreateRequest
from src.services.dingtalk_client import InMemoryDingTalkClient, RunRecord


class RunService:
    def __init__(self, control_plane: InMemoryDingTalkClient) -> None:
        self._control_plane = control_plane

    def create(self, request: RunCreateRequest) -> RunRecord:
        return self._control_plane.create_task_record(request.task_type, request.params, request.idempotency_key)

    def get(self, run_id: str) -> RunRecord:
        return self._control_plane.get_task_record(run_id)

    def confirm(self, run_id: str, request: RunConfirmRequest) -> RunRecord:
        return self._control_plane.confirm_materials(
            run_id=run_id,
            approved_material_ids=request.approved_material_ids,
            rejected_material_ids=request.rejected_material_ids,
            reviewer_id=request.reviewer_id,
            comment=request.comment,
            expected_version=request.expected_version,
        )
