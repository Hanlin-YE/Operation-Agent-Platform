import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

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


if __name__ == "__main__":
    unittest.main()
