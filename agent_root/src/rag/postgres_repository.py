from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from src.rag.domain import Citation, DocumentType, RagChunk, RagDocument, ReviewStatus, SearchHit
from src.rag.models import DocumentChunkModel, SourceDocumentModel


class PostgresRagRepository:
    def __init__(self, sessions: async_sessionmaker[AsyncSession]) -> None:
        self._sessions = sessions

    async def get_document_by_checksum(self, checksum: str) -> RagDocument | None:
        async with self._sessions() as session:
            existing = await session.scalar(select(SourceDocumentModel).where(SourceDocumentModel.checksum == checksum))
        return self._document(existing) if existing else None

    @staticmethod
    def _document(model: SourceDocumentModel) -> RagDocument:
        return RagDocument(
            id=model.id,
            title=model.title,
            document_type=model.document_type,
            source_url=model.source_url,
            storage_path=model.storage_path,
            checksum=model.checksum,
            metadata=model.metadata_json,
            review_status=model.review_status,
            reviewer_id=model.reviewer_id,
            reviewed_at=model.reviewed_at,
            created_at=model.created_at,
        )

    async def add_document(self, document: RagDocument) -> RagDocument:
        async with self._sessions() as session:
            existing = await session.scalar(select(SourceDocumentModel).where(SourceDocumentModel.checksum == document.checksum))
            if existing:
                return self._document(existing)
            model = SourceDocumentModel(
                id=document.id,
                title=document.title,
                document_type=document.document_type.value,
                source_url=document.source_url,
                storage_path=document.storage_path,
                checksum=document.checksum,
                metadata_json=document.metadata,
                review_status=document.review_status.value,
                created_at=document.created_at,
            )
            session.add(model)
            await session.commit()
            return document

    async def add_chunks(self, chunks: list[RagChunk]) -> None:
        async with self._sessions() as session:
            session.add_all(
                [
                    DocumentChunkModel(
                        id=chunk.id,
                        document_id=chunk.document_id,
                        text=chunk.text,
                        page_number=chunk.page_number,
                        section_path=chunk.section_path,
                        claim_number=chunk.claim_number,
                        embedding=chunk.embedding,
                        created_at=chunk.created_at,
                    )
                    for chunk in chunks
                ]
            )
            await session.commit()

    async def approve_document(self, document_id: str, reviewer_id: str) -> RagDocument:
        async with self._sessions() as session:
            document = await session.get(SourceDocumentModel, document_id)
            if not document:
                raise KeyError(document_id)
            document.review_status = ReviewStatus.APPROVED.value
            document.reviewer_id = reviewer_id
            document.reviewed_at = datetime.now(UTC)
            await session.commit()
            return self._document(document)

    async def search_approved(
        self, embedding: list[float], limit: int, document_type: DocumentType | None = None
    ) -> list[SearchHit]:
        distance = DocumentChunkModel.embedding.cosine_distance(embedding).label("distance")
        statement = (
            select(DocumentChunkModel, SourceDocumentModel, distance)
            .join(SourceDocumentModel, SourceDocumentModel.id == DocumentChunkModel.document_id)
            .where(SourceDocumentModel.review_status == ReviewStatus.APPROVED.value)
            .order_by(distance)
            .limit(limit)
        )
        if document_type:
            statement = statement.where(SourceDocumentModel.document_type == document_type.value)
        async with self._sessions() as session:
            rows = (await session.execute(statement)).all()
        return [
            SearchHit(
                chunk_id=chunk.id,
                text=chunk.text,
                score=max(0.0, 1.0 - float(row_distance)),
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
            for chunk, document, row_distance in rows
        ]
