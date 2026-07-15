from __future__ import annotations

from datetime import datetime
from enum import StrEnum
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from src.core.run_state import RunStatus


class TaskType(StrEnum):
    PROFILER = "profiler"
    INQUIRY = "inquiry"
    DISPATCH = "dispatch"
    LIFECYCLE = "lifecycle"


_DISALLOWED_PARAM_KEYS = {"html", "raw_html", "raw_text", "page_content", "dom", "document"}


def _contains_disallowed_payload(value: Any) -> bool:
    if isinstance(value, dict):
        return any(str(key).lower() in _DISALLOWED_PARAM_KEYS or _contains_disallowed_payload(item) for key, item in value.items())
    if isinstance(value, list):
        return any(_contains_disallowed_payload(item) for item in value)
    return False


class RunCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    task_type: TaskType
    params: dict[str, Any] = Field(max_length=16_384)
    idempotency_key: str = Field(min_length=16, max_length=128)

    @field_validator("params")
    @classmethod
    def reject_raw_web_payloads(cls, value: dict[str, Any]) -> dict[str, Any]:
        if _contains_disallowed_payload(value):
            raise ValueError("params must not contain raw HTML or large raw text fields")
        return value

    @model_validator(mode="after")
    def enforce_url_limit(self) -> "RunCreateRequest":
        urls = self.params.get("seed_urls", [])
        if urls and (not isinstance(urls, list) or len(urls) > 10 or not all(isinstance(url, str) for url in urls)):
            raise ValueError("seed_urls must be a list of at most 10 URLs")
        return self


class CreateRunResponse(BaseModel):
    code: int = 202
    run_id: str
    status: RunStatus
    poll_url: str


class RunLog(BaseModel):
    at: datetime
    level: str
    event: str
    message: str


class RunProgress(BaseModel):
    step: str
    percent: int = Field(ge=0, le=100)


class RunReview(BaseModel):
    required: bool
    approved_count: int = Field(ge=0)
    rejected_count: int = Field(ge=0)
    material_ids: list[str] = Field(default_factory=list)


class RunError(BaseModel):
    code: str
    message: str


class RunDetailResponse(BaseModel):
    run_id: str
    task_type: TaskType
    status: RunStatus
    version: int = Field(ge=1)
    lifecycle_state: str | None = None
    created_at: datetime
    updated_at: datetime
    progress: RunProgress
    logs: list[RunLog]
    review: RunReview
    collected_items: list[dict[str, Any]] = Field(default_factory=list)
    result: dict[str, Any] | None = None
    error: RunError | None = None


class RunConfirmRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    reviewer_id: str = Field(min_length=1, max_length=128)
    approved_material_ids: list[str] = Field(min_length=1, max_length=100)
    rejected_material_ids: list[str] = Field(default_factory=list, max_length=100)
    comment: str | None = Field(default=None, max_length=2_000)
    expected_version: int = Field(ge=1)

    @model_validator(mode="after")
    def material_lists_must_not_overlap(self) -> "RunConfirmRequest":
        if set(self.approved_material_ids) & set(self.rejected_material_ids):
            raise ValueError("approved_material_ids and rejected_material_ids must not overlap")
        return self


class ConfirmRunResponse(BaseModel):
    code: int = 202
    run_id: str
    status: RunStatus


class GraphNode(BaseModel):
    id: str
    label: str
    type: str
    properties: dict[str, Any] = Field(default_factory=dict)


class GraphEdge(BaseModel):
    id: str
    source: str
    target: str
    type: str


class GraphMeta(BaseModel):
    node_count: int = Field(ge=0)
    edge_count: int = Field(ge=0)


class GraphSnapshotResponse(BaseModel):
    nodes: list[GraphNode]
    edges: list[GraphEdge]
    meta: GraphMeta
