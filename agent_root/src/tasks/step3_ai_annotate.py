from __future__ import annotations

from typing import TypeVar

from pydantic import BaseModel

from src.services.llm_provider import GraphContext, LlmProvider

T = TypeVar("T", bound=BaseModel)


async def annotate_from_approved_graph_context(
    provider: LlmProvider, context: GraphContext, output_model: type[T], instruction: str
) -> T:
    """Step 3 must only receive pre-approved graph context."""
    return await provider.generate_json(context, output_model, instruction)
