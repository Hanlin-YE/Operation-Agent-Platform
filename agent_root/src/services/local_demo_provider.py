from __future__ import annotations

from typing import TypeVar

from pydantic import BaseModel

from src.services.llm_provider import GraphContext

T = TypeVar("T", bound=BaseModel)


class LocalDemoProvider:
    """Deterministic provider used when external model credentials are absent."""

    model_name = "local-demo-v1"
    consecutive_overages = 0

    async def generate_json(self, context: GraphContext, output_model: type[T], instruction: str) -> T:
        entity_names = [
            str(entity)
            for item in context.evidence
            for entity in item.get("entities", [])
            if entity
        ]
        unique_entities = list(dict.fromkeys(entity_names))
        return output_model.model_validate(
            {
                "summary": f"已基于 {len(context.evidence)} 条审核素材完成结构化标注。",
                "entities": unique_entities,
                "recommended_actions": ["核验新实体", "进入后续线索处理"],
            }
        )
