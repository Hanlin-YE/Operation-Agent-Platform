import asyncio
import tempfile
import unittest

from fastapi.testclient import TestClient


class RagServiceTests(unittest.TestCase):
    def test_only_approved_chunks_are_retrievable_with_citations(self) -> None:
        from src.rag.embeddings import DeterministicEmbeddingProvider
        from src.rag.repository import InMemoryRagRepository
        from src.rag.service import RagService

        repository = InMemoryRagRepository()
        service = RagService(repository, DeterministicEmbeddingProvider(dimensions=32))

        document = asyncio.run(
            service.ingest_text(
                title="石墨微尺度自超滑研究",
                document_type="paper",
                text="第一页介绍石墨微尺度自超滑。\f第二页讨论接触取向和摩擦失效边界。",
                source_url="https://example.test/paper",
                metadata={"doi": "10.0000/example", "year": 2026},
            )
        )

        self.assertEqual(asyncio.run(service.search("摩擦失效边界")), [])

        asyncio.run(service.approve_document(document.id, reviewer_id="reviewer-1"))
        hits = asyncio.run(service.search("摩擦失效边界"))

        self.assertGreaterEqual(len(hits), 1)
        self.assertEqual(hits[0].citation.document_id, document.id)
        self.assertEqual(hits[0].citation.title, "石墨微尺度自超滑研究")
        self.assertEqual(hits[0].citation.page_number, 2)
        self.assertIn("摩擦失效边界", hits[0].text)

    def test_rag_api_enforces_review_gate_and_returns_page_citation(self) -> None:
        from src.main import create_app

        with TestClient(create_app(start_runner=False)) as client:
            created = client.post(
                "/api/rag/documents/text",
                json={
                    "title": "自超滑专利样例",
                    "document_type": "patent",
                    "text": "第一页说明技术背景。\f第二页给出独立权利要求中的接触结构。",
                    "metadata": {"publication_number": "CN-DEMO"},
                },
            )
            self.assertEqual(created.status_code, 201)
            document_id = created.json()["id"]

            hidden = client.post("/api/rag/search", json={"query": "独立权利要求"})
            self.assertEqual(hidden.status_code, 200)
            self.assertEqual(hidden.json(), [])

            approved = client.post(
                f"/api/rag/documents/{document_id}/approve",
                json={"reviewer_id": "reviewer-1"},
            )
            self.assertEqual(approved.status_code, 200)

            search = client.post("/api/rag/search", json={"query": "独立权利要求"})
            self.assertEqual(search.status_code, 200)
            self.assertEqual(search.json()[0]["citation"]["page_number"], 2)

    def test_batch_pdf_upload_infers_a_title_for_each_file(self) -> None:
        from src.main import create_app
        from src.rag.storage import LocalDocumentStorage

        app = create_app(start_runner=False)
        with tempfile.TemporaryDirectory() as directory:
            app.state.document_storage = LocalDocumentStorage(directory)
            with TestClient(app) as client:
                response = client.post(
                    "/api/rag/documents/upload/batch",
                    data={"document_type": "paper", "metadata_json": "{}"},
                    files=[
                        ("files", ("301-2025-Ultrahigh Thermal Conductance across Superlubric Interfaces.pdf", b"%PDF-1.4\n%%EOF", "application/pdf")),
                        ("files", ("Graphite_superlubricity_review.pdf", b"%PDF-1.4\n% second\n%%EOF", "application/pdf")),
                    ],
                )

        self.assertEqual(response.status_code, 201)
        body = response.json()
        self.assertEqual(body["created_count"], 2)
        self.assertEqual(body["failed_count"], 0)
        self.assertEqual(body["documents"][0]["title"], "Ultrahigh Thermal Conductance across Superlubric Interfaces")
        self.assertEqual(body["documents"][1]["title"], "Graphite superlubricity review")


if __name__ == "__main__":
    unittest.main()
