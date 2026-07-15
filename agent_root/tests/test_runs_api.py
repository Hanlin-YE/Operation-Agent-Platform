import unittest

from fastapi.testclient import TestClient


class RunsApiContractTests(unittest.TestCase):
    def test_create_run_returns_202_and_a_pollable_pending_record(self) -> None:
        from src.main import create_app

        with TestClient(create_app(start_runner=False)) as client:
            created = client.post(
                "/api/runs",
                json={
                    "task_type": "profiler",
                    "params": {"industry": "航空", "seed_urls": ["https://example.com/news/1"]},
                    "idempotency_key": "test-request-00000001",
                },
            )

            self.assertEqual(created.status_code, 202)
            body = created.json()
            self.assertEqual(body["status"], "PENDING")
            self.assertTrue(body["run_id"])

            fetched = client.get(body["poll_url"])
            self.assertEqual(fetched.status_code, 200)
            self.assertEqual(fetched.json()["status"], "PENDING")

    def test_create_run_rejects_raw_html_in_params(self) -> None:
        from src.main import create_app

        with TestClient(create_app(start_runner=False)) as client:
            response = client.post(
                "/api/runs",
                json={
                    "task_type": "profiler",
                    "params": {"html": "<html><body>not allowed</body></html>"},
                    "idempotency_key": "test-request-00000002",
                },
            )

        self.assertEqual(response.status_code, 422)


if __name__ == "__main__":
    unittest.main()
