from __future__ import annotations

import os
from typing import Literal
from urllib.parse import urlparse

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, ConfigDict

from src.tasks.step1_crawl import crawl_and_extract

router = APIRouter(prefix="/api/market-research", tags=["market-research"])


class MarketResearchRequest(BaseModel):
    """The requested research stream; sources stay server-managed."""

    model_config = ConfigDict(extra="forbid")

    subject_type: Literal["competitor", "customer"]


class MarketResearchResponse(BaseModel):
    subject_name: str
    subject_type: Literal["competitor", "customer"]
    source_url: str
    page_title: str
    public_excerpt: str
    observed_companies: list[str]
    research_angles: list[str]
    review_status: Literal["needs_review"] = "needs_review"
    notice: str


def _allowed_domains() -> set[str]:
    return {domain.strip().lower() for domain in os.getenv("CRAWL_ALLOWED_DOMAINS", "").split(",") if domain.strip()}


def _seed_url(subject_type: str) -> str | None:
    setting = "MARKET_RESEARCH_COMPETITOR_SEED_URLS" if subject_type == "competitor" else "MARKET_RESEARCH_CUSTOMER_SEED_URLS"
    return next((url.strip() for url in os.getenv(setting, "").split(",") if url.strip()), None)


def _research_angles(subject_type: str) -> list[str]:
    if subject_type == "competitor":
        return ["产品/方案", "应用与客户案例", "公开渠道与定位"]
    return ["业务与应用场景", "潜在技术需求", "公开采购与合作线索"]


@router.post("/crawl", response_model=MarketResearchResponse)
async def crawl_public_page(payload: MarketResearchRequest) -> MarketResearchResponse:
    """Collect from a server-managed public source; all use requires review."""
    source_url = _seed_url(payload.subject_type)
    if not source_url:
        raise HTTPException(status_code=503, detail="该调查类型尚未配置采集来源，请联系管理员配置公开来源。")
    try:
        material = await crawl_and_extract(
            source_url,
            allowed_domains=_allowed_domains(),
            timeout_ms=min(max(int(os.getenv("PLAYWRIGHT_TIMEOUT_MS", "20000")), 1_000), 30_000),
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception:
        # Do not expose browser or network details to the public web client.
        raise HTTPException(status_code=502, detail="公开网页暂时无法采集，请检查网址或稍后重试。") from None

    return MarketResearchResponse(
        subject_name=material.title or urlparse(source_url).hostname or "公开信息来源",
        subject_type=payload.subject_type,
        source_url=material.source_url,
        page_title=material.title or payload.subject_name.strip(),
        public_excerpt=material.summary,
        observed_companies=[str(entity["name"]) for entity in material.entities if entity.get("type") == "Company"],
        research_angles=_research_angles(payload.subject_type),
        notice="仅采集公开页面的清洗摘要，不保存登录态或下载内容；页面信息须经人工核验后才能用于市场判断或销售动作。",
    )
