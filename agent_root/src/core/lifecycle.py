from __future__ import annotations

from pydantic import BaseModel, Field


class RetentionDecision(BaseModel):
    message: str = Field(max_length=200)
    next_action: str = Field(max_length=120)
    insufficient_evidence: bool = False
