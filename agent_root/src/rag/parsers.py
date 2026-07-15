from __future__ import annotations

from typing import Protocol

from pydantic import BaseModel, Field


class ParsedPage(BaseModel):
    page_number: int
    text: str
    sections: list[str] = Field(default_factory=list)


class ParsedDocument(BaseModel):
    pages: list[ParsedPage]
    metadata: dict[str, object] = Field(default_factory=dict)
    references: list[dict[str, object]] = Field(default_factory=list)


class DocumentParser(Protocol):
    @property
    def name(self) -> str: ...

    async def parse(self, file_path: str, document_type: str) -> ParsedDocument: ...


class ParserNotConfiguredError(RuntimeError):
    pass


class DeferredScientificDocumentParser:
    """Contract boundary for Docling + GROBID, activated when PDFs arrive."""

    name = "docling+grobid"

    async def parse(self, file_path: str, document_type: str) -> ParsedDocument:
        raise ParserNotConfiguredError("PDF parser runtime is not enabled yet; the source is safely registered for later parsing.")
