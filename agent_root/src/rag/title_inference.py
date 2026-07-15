from __future__ import annotations

import re
from io import BytesIO
from pathlib import Path


def _clean_title(value: str) -> str:
    title = value.strip().replace("_", " ")
    title = re.sub(r"\s+", " ", title)
    return title.strip(" ._-")


def title_from_filename(filename: str) -> str:
    stem = Path(filename or "document.pdf").stem
    # Common export pattern: sequence-year-title.pdf
    stem = re.sub(r"^\d{1,4}[-_. ]+(?:19|20)\d{2}[-_. ]+", "", stem)
    # Common paper library pattern: year-title.pdf
    stem = re.sub(r"^(?:19|20)\d{2}[-_. ]+", "", stem)
    return _clean_title(stem) or "未命名 PDF"


def infer_pdf_title(content: bytes, filename: str) -> tuple[str, str]:
    try:
        from pypdf import PdfReader

        metadata = PdfReader(BytesIO(content), strict=False).metadata
        metadata_title = _clean_title(str(metadata.title or "")) if metadata else ""
        if metadata_title and metadata_title.lower() not in {"untitled", "microsoft word", "document"}:
            return metadata_title, "pdf_metadata"
    except Exception:
        pass
    raw_title = re.search(rb"/Title\s*\(([^)]{1,1000})\)", content, re.DOTALL)
    if raw_title:
        try:
            decoded = raw_title.group(1).replace(rb"\(", b"(").replace(rb"\)", b")").decode("utf-8", errors="ignore")
            cleaned = _clean_title(decoded)
            if cleaned:
                return cleaned, "pdf_metadata"
        except Exception:
            pass
    return title_from_filename(filename), "filename"
