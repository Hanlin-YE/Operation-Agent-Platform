from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request, status

from src.api.schemas import ConfirmRunResponse, CreateRunResponse, GraphSnapshotResponse, RunConfirmRequest, RunCreateRequest, RunDetailResponse
from src.core.run_service import RunService
from src.services.dingtalk_client import RunNotFoundError, RunStateConflictError, RunVersionConflictError

router = APIRouter(prefix="/api/runs", tags=["runs"])
graph_router = APIRouter(prefix="/api/graph", tags=["graph"])


def _service(request: Request) -> RunService:
    return request.app.state.run_service


@graph_router.get("", response_model=GraphSnapshotResponse)
async def graph_snapshot(request: Request) -> GraphSnapshotResponse:
    return GraphSnapshotResponse.model_validate(await request.app.state.graph_service.snapshot())


@router.post("", response_model=CreateRunResponse, status_code=status.HTTP_202_ACCEPTED)
def create_run(payload: RunCreateRequest, request: Request) -> CreateRunResponse:
    record = _service(request).create(payload)
    return CreateRunResponse(run_id=record.run_id, status=record.status, poll_url=f"/api/runs/{record.run_id}")


@router.get("/{run_id}", response_model=RunDetailResponse)
def get_run(run_id: str, request: Request) -> RunDetailResponse:
    try:
        return RunDetailResponse.model_validate(_service(request).get(run_id).as_detail())
    except RunNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="run not found") from exc


@router.post("/{run_id}/confirm", response_model=ConfirmRunResponse, status_code=status.HTTP_202_ACCEPTED)
def confirm_run(run_id: str, payload: RunConfirmRequest, request: Request) -> ConfirmRunResponse:
    try:
        record = _service(request).confirm(run_id, payload)
        return ConfirmRunResponse(run_id=record.run_id, status=record.status)
    except RunNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="run not found") from exc
    except (RunVersionConflictError, RunStateConflictError) as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="run state or version conflict") from exc
