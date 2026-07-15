from __future__ import annotations

from pydantic import BaseModel, Field


class DispatchDecision(BaseModel):
    scenario: str = Field(max_length=80)
    confidence: float = Field(ge=0, le=1)
    rationale: str = Field(max_length=200)
    video_key: str = Field(max_length=100)
