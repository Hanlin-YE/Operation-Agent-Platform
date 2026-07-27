from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Request
from pydantic import BaseModel, ConfigDict, Field

from src.services.company_graph_importer import build_company_graph_import_preview


router = APIRouter(prefix="/api/graph/import", tags=["graph-import"])


class CompanyGraphImportRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    profiles: list[dict[str, Any]] = Field(min_length=1, max_length=100)
    source: str = Field(default="company-profile-import", max_length=128)


@router.post("/preview")
def preview_company_graph_import(payload: CompanyGraphImportRequest) -> dict[str, Any]:
    return build_company_graph_import_preview(payload.profiles)


@router.post("/confirm")
async def confirm_company_graph_import(payload: CompanyGraphImportRequest, request: Request) -> dict[str, Any]:
    return await request.app.state.graph_service.import_company_profiles(payload.profiles, source=payload.source)
