import unittest
from unittest.mock import AsyncMock, patch

import httpx
from pydantic import BaseModel


class _Answer(BaseModel):
    answer: str


class LlmProviderContractTests(unittest.IsolatedAsyncioTestCase):
    def test_openai_compatible_provider_is_created_from_generic_config(self) -> None:
        from src.services.llm_provider import LlmProviderConfig, create_llm_provider
        from src.services.openai_compatible_provider import OpenAICompatibleProvider

        provider = create_llm_provider(
            LlmProviderConfig(
                provider="openai_compatible",
                api_key="test-key",
                base_url="https://models.example.test/v1",
                model="any-model-name",
            )
        )

        self.assertIsInstance(provider, OpenAICompatibleProvider)
        self.assertEqual(provider.model_name, "any-model-name")

    def test_unknown_provider_is_rejected_before_any_model_call(self) -> None:
        from src.services.llm_provider import LlmProviderConfig, UnsupportedLlmProviderError, create_llm_provider

        with self.assertRaises(UnsupportedLlmProviderError):
            create_llm_provider(LlmProviderConfig(provider="unsupported", api_key="x", base_url="https://example.test", model="m"))

    async def test_responses_mode_uses_the_openai_responses_endpoint_with_json_schema(self) -> None:
        from src.services.llm_provider import GraphContext, LlmProviderConfig
        from src.services.openai_compatible_provider import OpenAICompatibleProvider

        class FakeResponse:
            def raise_for_status(self): pass
            def json(self): return {"output_text": '{"answer":"已生成"}', "usage": {"input_tokens": 12, "output_tokens": 8}}

        class FakeClient:
            def __init__(self, **_): pass
            async def __aenter__(self): return self
            async def __aexit__(self, *_): pass
            post = AsyncMock(return_value=FakeResponse())

        client = FakeClient()
        with patch("httpx.AsyncClient", return_value=client):
            provider = OpenAICompatibleProvider(LlmProviderConfig(provider="openai_compatible", api_key="test-key", base_url="https://models.example.test/v1", model="gpt-5.4", api_mode="responses"))
            answer = await provider.generate_json(GraphContext(evidence=[]), _Answer, "生成答案")
        self.assertEqual(answer.answer, "已生成")
        url = client.post.await_args.args[0]
        request = client.post.await_args.kwargs["json"]
        self.assertEqual(url, "https://models.example.test/v1/responses")
        self.assertEqual(request["model"], "gpt-5.4")
        self.assertEqual(request["text"]["format"]["type"], "json_schema")

    async def test_responses_timeout_has_a_user_readable_error(self) -> None:
        from src.services.llm_provider import GraphContext, LlmProviderConfig
        from src.services.openai_compatible_provider import OpenAICompatibleProvider

        class TimeoutClient:
            def __init__(self, **_): pass
            async def __aenter__(self): return self
            async def __aexit__(self, *_): pass
            post = AsyncMock(side_effect=httpx.ReadTimeout(""))

        with patch("httpx.AsyncClient", return_value=TimeoutClient()), patch.dict("os.environ", {"LLM_REQUEST_TIMEOUT_SECONDS": "600"}):
            provider = OpenAICompatibleProvider(LlmProviderConfig(provider="openai_compatible", api_key="test-key", base_url="https://models.example.test", model="gpt-5.4", api_mode="responses"))
            with self.assertRaisesRegex(RuntimeError, "超过 60 秒"):
                await provider.generate_json(GraphContext(evidence=[]), _Answer, "生成答案")

    async def test_responses_mode_leaves_temporary_failure_for_explicit_task_retry(self) -> None:
        from src.services.llm_provider import GraphContext, LlmProviderConfig
        from src.services.openai_compatible_provider import OpenAICompatibleProvider

        request = httpx.Request("POST", "https://models.example.test/responses")
        unavailable = httpx.Response(502, request=request)

        class FakeResponse:
            def raise_for_status(self): pass
            def json(self): return {"output_text": '{"answer":"重试成功"}', "usage": {}}

        class RetryClient:
            calls = 0
            def __init__(self, **_): pass
            async def __aenter__(self): return self
            async def __aexit__(self, *_): pass
            async def post(self, *_args, **_kwargs):
                type(self).calls += 1
                if type(self).calls < 3:
                    raise httpx.HTTPStatusError("upstream unavailable", request=request, response=unavailable)
                return FakeResponse()

        with patch("httpx.AsyncClient", RetryClient), patch("asyncio.sleep", new=AsyncMock()):
            provider = OpenAICompatibleProvider(LlmProviderConfig(provider="openai_compatible", api_key="test-key", base_url="https://models.example.test", model="gpt-5.4", api_mode="responses"))
            with self.assertRaisesRegex(RuntimeError, "HTTP 502"):
                await provider.generate_json(GraphContext(evidence=[]), _Answer, "生成答案")

        self.assertEqual(RetryClient.calls, 1)

    async def test_responses_mode_reports_insufficient_provider_balance(self) -> None:
        from src.services.llm_provider import GraphContext, LlmProviderConfig
        from src.services.openai_compatible_provider import OpenAICompatibleProvider

        request = httpx.Request("POST", "https://models.example.test/responses")
        response = httpx.Response(403, request=request, json={"code": "INSUFFICIENT_BALANCE", "message": "Insufficient account balance"})

        class BalanceClient:
            def __init__(self, **_): pass
            async def __aenter__(self): return self
            async def __aexit__(self, *_): pass
            async def post(self, *_args, **_kwargs): return response

        with patch("httpx.AsyncClient", BalanceClient):
            provider = OpenAICompatibleProvider(LlmProviderConfig(provider="openai_compatible", api_key="test-key", base_url="https://models.example.test", model="gpt-5.4", api_mode="responses"))
            with self.assertRaisesRegex(RuntimeError, "账户余额不足"):
                await provider.generate_json(GraphContext(evidence=[]), _Answer, "生成答案")


if __name__ == "__main__":
    unittest.main()
