from __future__ import annotations

import math
from datetime import UTC, datetime
from typing import Protocol

from src.rag.domain import Citation, DocumentType, RagChunk, RagDocument, ReviewStatus, SearchHit


class RagRepository(Protocol):
    async def get_document_by_checksum(self, checksum: str) -> RagDocument | None: ...
    async def add_document(self, document: RagDocument) -> RagDocument: ...
    async def add_chunks(self, chunks: list[RagChunk]) -> None: ...
    async def approve_document(self, document_id: str, reviewer_id: str) -> RagDocument: ...
    async def search_approved(self, embedding: list[float], limit: int, document_type: DocumentType | None = None) -> list[SearchHit]: ...


def _cosine(left: list[float], right: list[float]) -> float:
    dot = sum(a * b for a, b in zip(left, right, strict=True))
    left_norm = math.sqrt(sum(value * value for value in left)) or 1.0
    right_norm = math.sqrt(sum(value * value for value in right)) or 1.0
    return dot / (left_norm * right_norm)


class InMemoryRagRepository:
    def __init__(self) -> None:
        self.documents: dict[str, RagDocument] = {}
        self.chunks: dict[str, RagChunk] = {}

    async def get_document_by_checksum(self, checksum: str) -> RagDocument | None:
        return next((item for item in self.documents.values() if item.checksum == checksum), None)

    async def add_document(self, document: RagDocument) -> RagDocument:
        existing = await self.get_document_by_checksum(document.checksum)
        if existing:
            return existing
        self.documents[document.id] = document
        return document

    async def add_chunks(self, chunks: list[RagChunk]) -> None:
        self.chunks.update({chunk.id: chunk for chunk in chunks})

    async def approve_document(self, document_id: str, reviewer_id: str) -> RagDocument:
        document = self.documents[document_id]
        document.review_status = ReviewStatus.APPROVED
        document.reviewer_id = reviewer_id
        document.reviewed_at = datetime.now(UTC)
        return document

    async def search_approved(
        self, embedding: list[float], limit: int, document_type: DocumentType | None = None
    ) -> list[SearchHit]:
        hits: list[SearchHit] = []
        for chunk in self.chunks.values():
            document = self.documents[chunk.document_id]
            if document.review_status is not ReviewStatus.APPROVED:
                continue
            if document_type and document.document_type is not document_type:
                continue
            hits.append(
                SearchHit(
                    chunk_id=chunk.id,
                    text=chunk.text,
                    score=_cosine(embedding, chunk.embedding),
                    citation=Citation(
                        document_id=document.id,
                        title=document.title,
                        document_type=document.document_type,
                        source_url=document.source_url,
                        page_number=chunk.page_number,
                        section_path=chunk.section_path,
                        claim_number=chunk.claim_number,
                        quote=chunk.text[:400],
                    ),
                )
            )
        return sorted(hits, key=lambda item: item.score, reverse=True)[:limit]
