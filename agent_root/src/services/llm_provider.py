from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Protocol, TypeVar

from pydantic import BaseModel


class GraphContext(BaseModel):
    """The only context shape allowed to cross into a model provider."""

    user_id: str | None = None
    evidence: list[dict[str, Any]]


@dataclass(frozen=True)
class TokenUsage:
    prompt_tokens: int
    completion_tokens: int

    @property
    def total_tokens(self) -> int:
        return self.prompt_tokens + self.completion_tokens


@dataclass(frozen=True)
class LlmProviderConfig:
    provider: str
    api_key: str
    base_url: str
    model: str
    api_mode: str = "chat_completions"
    token_warn_threshold: int = 2000


class UnsupportedLlmProviderError(ValueError):
    pass


T = TypeVar("T", bound=BaseModel)


class LlmProvider(Protocol):
    @property
    def model_name(self) -> str: ...

    @property
    def consecutive_overages(self) -> int: ...

    async def generate_json(self, context: GraphContext, output_model: type[T], instruction: str) -> T: ...


def create_llm_provider(config: LlmProviderConfig) -> LlmProvider:
    """Create an adapter without leaking provider-specific logic to business code."""
    if config.provider == "local_demo":
        from src.services.local_demo_provider import LocalDemoProvider

        return LocalDemoProvider()
    if config.provider == "openai_compatible":
        from src.services.openai_compatible_provider import OpenAICompatibleProvider

        return OpenAICompatibleProvider(config)
    raise UnsupportedLlmProviderError(f"Unsupported LLM provider: {config.provider}")
