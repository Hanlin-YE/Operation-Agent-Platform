from __future__ import annotations

from typing import TypeVar

from pydantic import BaseModel

from src.services.llm_provider import GraphContext, LlmProviderConfig, TokenUsage

T = TypeVar("T", bound=BaseModel)


class OpenAICompatibleProvider:
    """Adapter for any Chat Completions endpoint that accepts OpenAI-compatible requests."""

    def __init__(self, config: LlmProviderConfig) -> None:
        self._config = config
        self._consecutive_overages = 0

    @property
    def model_name(self) -> str:
        return self._config.model

    @property
    def consecutive_overages(self) -> int:
        return self._consecutive_overages

    def _record_usage(self, usage: TokenUsage) -> bool:
        overage = usage.total_tokens > self._config.token_warn_threshold
        self._consecutive_overages = self._consecutive_overages + 1 if overage else 0
        return overage

    async def generate_json(self, context: GraphContext, output_model: type[T], instruction: str) -> T:
        from openai import AsyncOpenAI

        client = AsyncOpenAI(api_key=self._config.api_key, base_url=self._config.base_url)
        response = await client.chat.completions.create(
            model=self._config.model,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": "Use only supplied evidence. Return valid JSON, no prose outside JSON."},
                {"role": "user", "content": f"Instruction: {instruction}\nContext: {context.model_dump_json()}"},
            ],
        )
        self._record_usage(
            TokenUsage(
                prompt_tokens=int(response.usage.prompt_tokens if response.usage else 0),
                completion_tokens=int(response.usage.completion_tokens if response.usage else 0),
            )
        )
        return output_model.model_validate_json(response.choices[0].message.content or "{}")
