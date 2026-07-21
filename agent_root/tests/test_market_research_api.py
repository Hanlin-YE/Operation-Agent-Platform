import unittest
import os
from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient


class MarketResearchApiTests(unittest.TestCase):
    def test_crawl_uses_server_managed_seed_for_the_selected_research_type(self) -> None:
        from src.main import create_app
        from src.processors.extractor import ExtractedMaterial

        material = ExtractedMaterial(
            title="Example Robotics | Precision Motion",
            summary="Example Robotics provides compact motion modules for laboratory automation.",
            entities=[{"name": "Example Robotics", "type": "Company", "confidence": 0.65}],
            emails=[],
            source_url="https://example.test/products",
            content_hash="sha256:demo",
        )
        with patch.dict(os.environ, {"MARKET_RESEARCH_COMPETITOR_SEED_URLS": "https://example.test/products"}, clear=False), patch(
            "src.api.market_research_routes.crawl_and_extract", new=AsyncMock(return_value=material)
        ) as crawl:
            with TestClient(create_app(start_runner=False)) as client:
                response = client.post(
                    "/api/market-research/crawl",
                    json={"subject_type": "competitor"},
                )

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["subject_type"], "competitor")
        self.assertEqual(body["source_url"], "https://example.test/products")
        self.assertEqual(body["review_status"], "needs_review")
        self.assertIn("产品/方案", body["research_angles"])
        crawl.assert_awaited_once()

    def test_crawl_requires_a_server_managed_seed_for_the_selected_type(self) -> None:
        from src.main import create_app

        with patch.dict(os.environ, {"MARKET_RESEARCH_CUSTOMER_SEED_URLS": ""}, clear=False):
            with TestClient(create_app(start_runner=False)) as client:
                response = client.post("/api/market-research/crawl", json={"subject_type": "customer"})

        self.assertEqual(response.status_code, 503)


if __name__ == "__main__":
    unittest.main()
