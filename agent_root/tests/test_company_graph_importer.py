import unittest


class CompanyGraphImporterTests(unittest.IsolatedAsyncioTestCase):
    def test_preview_merges_duplicate_company_and_counts_relationships(self) -> None:
        from src.services.company_graph_importer import build_company_graph_import_preview

        preview = build_company_graph_import_preview(
            [
                {
                    "companyName": "示例机器人",
                    "creditCode": "91110000MA00000001",
                    "applicationScenarios": ["人形机器人与灵巧手"],
                    "painSignals": ["温升"],
                    "evidenceLinks": [{"title": "官网", "url": "https://example.com", "source": "公开网页"}],
                },
                {
                    "companyName": "示例机器人科技有限公司",
                    "creditCode": "91110000MA00000001",
                    "applicationScenarios": ["医疗机器人与精密医疗设备"],
                    "riskSummary": "建议人工核验",
                },
            ]
        )

        self.assertEqual(preview["summary"]["company_count"], 1)
        self.assertGreaterEqual(preview["summary"]["new_relationship_count"], 2)
        self.assertTrue(any(item["type"] == "GraphEntity" and item["id"].startswith("company:") for item in preview["nodes"]))
        self.assertTrue(any(conflict["field"] == "companyName" for conflict in preview["conflicts"]))

    async def test_confirm_import_uses_parameterized_merge(self) -> None:
        from src.services.company_graph_importer import import_company_profiles_to_neo4j

        class FakeClient:
            def __init__(self) -> None:
                self.calls = []

            async def run_cypher(self, query, parameters):
                self.calls.append((query, parameters))
                return []

        client = FakeClient()
        result = await import_company_profiles_to_neo4j(
            client,
            [{"companyName": "示例机器人", "creditCode": "91110000MA00000001", "applicationScenarios": ["人形机器人与灵巧手"]}],
            source="test",
        )

        self.assertEqual(result["summary"]["company_count"], 1)
        self.assertTrue(any("MERGE (node:GraphEntity" in query for query, _ in client.calls))
        self.assertTrue(all(isinstance(parameters, dict) for _, parameters in client.calls))


if __name__ == "__main__":
    unittest.main()
