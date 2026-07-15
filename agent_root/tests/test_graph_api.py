import unittest

from fastapi.testclient import TestClient


class _FakeGraphService:
    async def snapshot(self) -> dict[str, object]:
        return {
            "nodes": [
                {"id": "account:acme", "label": "华东智造", "type": "Account", "properties": {"industry": "工业自动化"}},
                {"id": "product:servo", "label": "伺服电机", "type": "Product", "properties": {"series": "MS"}},
            ],
            "edges": [
                {"id": "account:acme:USES:product:servo", "source": "account:acme", "target": "product:servo", "type": "USES"}
            ],
            "meta": {"node_count": 2, "edge_count": 1},
        }


class GraphApiContractTests(unittest.TestCase):
    def test_graph_snapshot_returns_nodes_and_relationships(self) -> None:
        from src.main import create_app

        app = create_app(start_runner=False)
        app.state.graph_service = _FakeGraphService()

        with TestClient(app) as client:
            response = client.get("/api/graph")

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["meta"], {"node_count": 2, "edge_count": 1})
        self.assertEqual(body["nodes"][0]["type"], "Account")
        self.assertEqual(body["edges"][0]["type"], "USES")


if __name__ == "__main__":
    unittest.main()
