from __future__ import annotations

from datetime import UTC, datetime
from enum import StrEnum
from typing import Any
from uuid import uuid4

from pydantic import BaseModel, Field


class DocumentType(StrEnum):
    PAPER = "paper"
    PATENT = "patent"
    PRODUCT = "product"
    STANDARD = "standard"


class ReviewStatus(StrEnum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class RagDocument(BaseModel):
    id: str = Field(default_factory=lambda: f"doc_{uuid4().hex}")
    title: str
    document_type: DocumentType
    source_url: str | None = None
    storage_path: str | None = None
    checksum: str
    metadata: dict[str, Any] = Field(default_factory=dict)
    review_status: ReviewStatus = ReviewStatus.PENDING
    reviewer_id: str | None = None
    reviewed_at: datetime | None = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))


class RagChunk(BaseModel):
    id: str = Field(default_factory=lambda: f"chk_{uuid4().hex}")
    document_id: str
    text: str
    page_number: int
    section_path: str | None = None
    claim_number: str | None = None
    embedding: list[float]
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))


class Citation(BaseModel):
    document_id: str
    title: str
    document_type: DocumentType
    source_url: str | None = None
    page_number: int
    section_path: str | None = None
    claim_number: str | None = None
    quote: str


class SearchHit(BaseModel):
    chunk_id: str
    text: str
    score: float
    citation: Citation
