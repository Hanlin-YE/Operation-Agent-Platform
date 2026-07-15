from __future__ import annotations

import hashlib
from typing import Any

from src.rag.chunking import chunk_pages
from src.rag.domain import DocumentType, RagChunk, RagDocument, SearchHit
from src.rag.embeddings import EmbeddingProvider
from src.rag.repository import RagRepository


class RagService:
    def __init__(self, repository: RagRepository, embeddings: EmbeddingProvider) -> None:
        self._repository = repository
        self._embeddings = embeddings

    async def ingest_text(
        self,
        *,
        title: str,
        document_type: DocumentType | str,
        text: str,
        source_url: str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> RagDocument:
        if not text.strip():
            raise ValueError("document text must not be empty")
        checksum = hashlib.sha256(text.encode("utf-8")).hexdigest()
        existing = await self._repository.get_document_by_checksum(checksum)
        if existing:
            return existing
        document = await self._repository.add_document(
            RagDocument(
                title=title,
                document_type=DocumentType(document_type),
                source_url=source_url,
                checksum=checksum,
                metadata={**(metadata or {}), "embedding_model": self._embeddings.model_name},
            )
        )
        page_chunks = chunk_pages(text)
        vectors = await self._embeddings.embed([chunk for _, chunk in page_chunks])
        await self._repository.add_chunks(
            [
                RagChunk(document_id=document.id, text=chunk, page_number=page_number, embedding=embedding)
                for (page_number, chunk), embedding in zip(page_chunks, vectors, strict=True)
            ]
        )
        return document

    async def approve_document(self, document_id: str, reviewer_id: str) -> RagDocument:
        return await self._repository.approve_document(document_id, reviewer_id)

    async def register_file(
        self,
        *,
        title: str,
        document_type: DocumentType | str,
        checksum: str,
        storage_path: str,
        source_url: str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> RagDocument:
        existing = await self._repository.get_document_by_checksum(checksum)
        if existing:
            return existing
        return await self._repository.add_document(
            RagDocument(
                title=title,
                document_type=DocumentType(document_type),
                source_url=source_url,
                storage_path=storage_path,
                checksum=checksum,
                metadata={**(metadata or {}), "parse_status": "pending", "parser_target": "docling+grobid"},
            )
        )

    async def search(
        self, query: str, *, limit: int = 8, document_type: DocumentType | str | None = None
    ) -> list[SearchHit]:
        if not query.strip():
            return []
        embedding = (await self._embeddings.embed([query]))[0]
        parsed_type = DocumentType(document_type) if document_type else None
        return await self._repository.search_approved(embedding, min(max(limit, 1), 50), parsed_type)
