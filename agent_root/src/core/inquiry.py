from __future__ import annotations

from pydantic import BaseModel, Field


class InquiryDecision(BaseModel):
    questions: list[str] = Field(min_length=1, max_length=5)
    suggested_channel: str = Field(max_length=30)
    rationale: str = Field(max_length=200)
