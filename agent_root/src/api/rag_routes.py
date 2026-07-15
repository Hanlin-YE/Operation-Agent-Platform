from __future__ import annotations

import json
from email import policy
from email.parser import BytesParser
from typing import Any

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field

from src.rag.domain import DocumentType, RagDocument, SearchHit
from src.rag.service import RagService
from src.rag.storage import InvalidPdfError, LocalDocumentStorage
from src.rag.title_inference import infer_pdf_title

router = APIRouter(prefix="/api/rag", tags=["rag"])


class TextDocumentRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    title: str = Field(min_length=1, max_length=500)
    document_type: DocumentType
    text: str = Field(min_length=1, max_length=2_000_000)
    source_url: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class ApproveDocumentRequest(BaseModel):
    reviewer_id: str = Field(min_length=1, max_length=128)


class SearchRequest(BaseModel):
    query: str = Field(min_length=1, max_length=2_000)
    limit: int = Field(default=8, ge=1, le=50)
    document_type: DocumentType | None = None


def _service(request: Request) -> RagService:
    return request.app.state.rag_service


async def _read_multipart(request: Request) -> tuple[dict[str, str], list[dict[str, object]]]:
    content_type = request.headers.get("content-type", "")
    if "multipart/form-data" not in content_type:
        raise HTTPException(status_code=415, detail="multipart/form-data is required")
    raw = await request.body()
    message = BytesParser(policy=policy.default).parsebytes(
        f"Content-Type: {content_type}\r\nMIME-Version: 1.0\r\n\r\n".encode() + raw
    )
    fields: dict[str, str] = {}
    files: list[dict[str, object]] = []
    for part in message.iter_parts():
        name = part.get_param("name", header="content-disposition")
        filename = part.get_filename()
        payload = part.get_payload(decode=True) or b""
        if filename:
            files.append({"name": name or "files", "filename": filename, "content_type": part.get_content_type(), "content": payload})
        elif name:
            fields[str(name)] = payload.decode(part.get_content_charset() or "utf-8", errors="replace")
    return fields, files


@router.get("/health")
def rag_health(request: Request) -> dict[str, object]:
    return {
        "status": "ready_for_ingest",
        "embedding_model": request.app.state.embedding_provider.model_name,
        "embedding_dimensions": request.app.state.embedding_provider.dimensions,
        "parser": request.app.state.document_parser.name,
        "parser_status": "deferred_until_pdf_validation",
    }


@router.post("/documents/text", response_model=RagDocument, status_code=201)
async def ingest_text(payload: TextDocumentRequest, request: Request) -> RagDocument:
    return await _service(request).ingest_text(**payload.model_dump())


@router.post("/documents/upload", response_model=RagDocument, status_code=201)
async def upload_pdf(request: Request) -> RagDocument:
    fields, files = await _read_multipart(request)
    if len(files) != 1:
        raise HTTPException(status_code=422, detail="exactly one PDF is required")
    file = files[0]
    if file["content_type"] not in {"application/pdf", "application/octet-stream"}:
        raise HTTPException(status_code=415, detail="only PDF uploads are accepted")
    try:
        metadata = json.loads(fields.get("metadata_json", "{}"))
        if not isinstance(metadata, dict):
            raise ValueError
    except (json.JSONDecodeError, ValueError) as exc:
        raise HTTPException(status_code=422, detail="metadata_json must be a JSON object") from exc
    content = bytes(file["content"])
    storage: LocalDocumentStorage = request.app.state.document_storage
    try:
        storage_path, checksum = storage.save_pdf(content)
    except InvalidPdfError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    filename = str(file["filename"] or "document.pdf")
    title = fields.get("title")
    detected_title, title_source = infer_pdf_title(content, filename)
    return await _service(request).register_file(
        title=title.strip() if title and title.strip() else detected_title,
        document_type=DocumentType(fields.get("document_type", "paper")),
        checksum=checksum,
        storage_path=storage_path,
        source_url=fields.get("source_url") or None,
        metadata={**metadata, "original_filename": filename, "title_source": "manual" if title and title.strip() else title_source},
    )


@router.post("/documents/upload/batch", status_code=201)
async def upload_pdf_batch(request: Request) -> dict[str, object]:
    fields, files = await _read_multipart(request)
    if not files or len(files) > 20:
        raise HTTPException(status_code=422, detail="upload between 1 and 20 PDF files")
    try:
        metadata = json.loads(fields.get("metadata_json", "{}"))
        if not isinstance(metadata, dict):
            raise ValueError
    except (json.JSONDecodeError, ValueError) as exc:
        raise HTTPException(status_code=422, detail="metadata_json must be a JSON object") from exc

    storage: LocalDocumentStorage = request.app.state.document_storage
    documents: list[dict[str, object]] = []
    failures: list[dict[str, str]] = []
    document_type = DocumentType(fields.get("document_type", "paper"))
    source_url = fields.get("source_url") or None
    for file in files:
        filename = str(file["filename"] or "document.pdf")
        try:
            if file["content_type"] not in {"application/pdf", "application/octet-stream"}:
                raise InvalidPdfError("only PDF uploads are accepted")
            content = bytes(file["content"])
            storage_path, checksum = storage.save_pdf(content)
            title, title_source = infer_pdf_title(content, filename)
            document = await _service(request).register_file(
                title=title,
                document_type=document_type,
                checksum=checksum,
                storage_path=storage_path,
                source_url=source_url,
                metadata={**metadata, "original_filename": filename, "title_source": title_source},
            )
            documents.append(document.model_dump(mode="json"))
        except (InvalidPdfError, ValueError) as exc:
            failures.append({"filename": filename, "message": str(exc)})

    return {
        "created_count": len(documents),
        "failed_count": len(failures),
        "documents": documents,
        "failures": failures,
    }


@router.post("/documents/{document_id}/approve", response_model=RagDocument)
async def approve_document(document_id: str, payload: ApproveDocumentRequest, request: Request) -> RagDocument:
    try:
        return await _service(request).approve_document(document_id, payload.reviewer_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="document not found") from exc


@router.post("/search", response_model=list[SearchHit])
async def search(payload: SearchRequest, request: Request) -> list[SearchHit]:
    return await _service(request).search(payload.query, limit=payload.limit, document_type=payload.document_type)
