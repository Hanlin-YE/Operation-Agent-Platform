from __future__ import annotations

from datetime import datetime

from pgvector.sqlalchemy import Vector
from sqlalchemy import DateTime, Float, ForeignKey, Index, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class SourceDocumentModel(Base):
    __tablename__ = "rag_source_documents"

    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    title: Mapped[str] = mapped_column(String(500))
    document_type: Mapped[str] = mapped_column(String(32), index=True)
    source_url: Mapped[str | None] = mapped_column(Text)
    storage_path: Mapped[str | None] = mapped_column(Text)
    checksum: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    metadata_json: Mapped[dict] = mapped_column(JSONB, default=dict)
    review_status: Mapped[str] = mapped_column(String(24), default="pending", index=True)
    reviewer_id: Mapped[str | None] = mapped_column(String(128))
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    chunks: Mapped[list["DocumentChunkModel"]] = relationship(back_populates="document", cascade="all, delete-orphan")


class DocumentChunkModel(Base):
    __tablename__ = "rag_document_chunks"

    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    document_id: Mapped[str] = mapped_column(ForeignKey("rag_source_documents.id", ondelete="CASCADE"), index=True)
    text: Mapped[str] = mapped_column(Text)
    page_number: Mapped[int] = mapped_column(Integer)
    section_path: Mapped[str | None] = mapped_column(String(500))
    claim_number: Mapped[str | None] = mapped_column(String(128), index=True)
    embedding: Mapped[list[float]] = mapped_column(Vector(1024))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    document: Mapped[SourceDocumentModel] = relationship(back_populates="chunks")


class EvidenceModel(Base):
    __tablename__ = "rag_evidence"

    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    chunk_id: Mapped[str] = mapped_column(ForeignKey("rag_document_chunks.id", ondelete="CASCADE"), index=True)
    quote: Mapped[str] = mapped_column(Text)
    evidence_type: Mapped[str] = mapped_column(String(64))
    confidence: Mapped[float] = mapped_column(Float, default=1.0)
    review_status: Mapped[str] = mapped_column(String(24), default="pending", index=True)
    reviewer_id: Mapped[str | None] = mapped_column(String(128))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


Index("ix_rag_chunks_embedding_hnsw", DocumentChunkModel.embedding, postgresql_using="hnsw", postgresql_ops={"embedding": "vector_cosine_ops"})
