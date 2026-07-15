from __future__ import annotations

from pydantic import BaseModel, Field

from src.services.llm_provider import GraphContext


class ProfileDecision(BaseModel):
    priority: str = Field(pattern="^(high|medium|low|insufficient_evidence)$")
    missing_fields: list[str] = Field(max_length=10)
    next_research_action: str = Field(max_length=200)


def build_profile_context(user_id: str | None, evidence: list[dict[str, object]]) -> GraphContext:
    return GraphContext(user_id=user_id, evidence=evidence[:5])
