import unittest


class LlmProviderContractTests(unittest.TestCase):
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


if __name__ == "__main__":
    unittest.main()
