from __future__ import annotations

import asyncio
import os
from typing import Any, TypeVar

import httpx

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
        if self._config.api_mode == "responses":
            endpoint = self._config.base_url.rstrip("/")
            if not endpoint.endswith("/responses"):
                endpoint = f"{endpoint}/responses"
            payload: dict[str, Any] = {
                "model": self._config.model,
                "max_output_tokens": self._config.max_tokens,
                "input": [
                    {"role": "system", "content": "Use only supplied evidence. Return valid JSON, no prose outside JSON."},
                    {"role": "user", "content": f"Instruction: {instruction}\nContext: {context.model_dump_json()}"},
                ],
                "text": {"format": {"type": "json_schema", "name": output_model.__name__, "strict": True, "schema": output_model.model_json_schema()}},
            }
            timeout = self._config.timeout_seconds
            for attempt in range(1):
                try:
                    # Some local developer environments export proxy/no_proxy values
                    # that make httpx hang while curl reaches the same endpoint.
                    async with httpx.AsyncClient(timeout=timeout, trust_env=False) as client:
                        response = await client.post(endpoint, headers={"Authorization": f"Bearer {self._config.api_key}"}, json=payload)
                        response.raise_for_status()
                    break
                except httpx.TimeoutException as exc:
                    raise RuntimeError(f"远程模型请求超过 {int(timeout)} 秒，请在本地设置检查连接或调整超时。") from exc
                except httpx.HTTPStatusError as exc:
                    code = exc.response.status_code
                    try:
                        error_body = exc.response.json()
                    except ValueError:
                        error_body = {}
                    if error_body.get("code") == "INSUFFICIENT_BALANCE":
                        raise RuntimeError("远程模型账户余额不足，请充值或更换可用的 API Key 后重试。") from exc
                    if code not in {502, 503, 504} or attempt == 0:
                        raise RuntimeError(f"远程模型服务暂时不可用（HTTP {code}），请稍后重试。") from exc
                    await asyncio.sleep(2 ** attempt)
            body = response.json()
            usage = body.get("usage") or {}
            self._record_usage(TokenUsage(
                prompt_tokens=int(usage.get("input_tokens", 0)),
                completion_tokens=int(usage.get("output_tokens", 0)),
            ))
            output = body.get("output_text")
            if not output:
                output = next((content.get("text") for item in body.get("output", []) for content in item.get("content", []) if content.get("type") == "output_text"), None)
            return output_model.model_validate_json(output or "{}")
        if self._config.api_mode != "chat_completions":
            raise ValueError("LLM_API_MODE 仅支持 chat_completions 或 responses。")
        from openai import AsyncOpenAI

        client = AsyncOpenAI(api_key=self._config.api_key, base_url=self._config.base_url, timeout=self._config.timeout_seconds, max_retries=0)
        response = await client.chat.completions.create(
            model=self._config.model,
            temperature=self._config.temperature,
            max_tokens=self._config.max_tokens,
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
