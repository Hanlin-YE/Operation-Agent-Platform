from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass
from urllib.parse import urlparse

from src.processors.cleaner import CleanDocument

MAX_MATERIAL_CHARS = 500
_EMAIL_RE = re.compile(r"(?<![\w.+-])[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}(?![\w.-])")
_COMPANY_RE = re.compile(r"[\u4e00-\u9fffA-Za-z0-9·&（）() -]{2,40}(?:有限公司|集团|公司|Inc\.|Ltd\.)")


@dataclass(frozen=True)
class ExtractedMaterial:
    summary: str
    entities: list[dict[str, object]]
    emails: list[str]
    title: str
    source_url: str
    content_hash: str

    def as_model_context(self) -> dict[str, object]:
        """Return the only permitted material representation for model context."""
        return {
            "summary": self.summary,
            "entities": self.entities,
            "meta": {"url": self.source_url, "title": self.title, "content_hash": self.content_hash},
        }


def compact_document(document: CleanDocument, source_url: str) -> ExtractedMaterial:
    normalized = re.sub(r"\s+", " ", document.text).strip()
    summary = normalized[:MAX_MATERIAL_CHARS].rstrip()
    entities = [
        {"name": name.strip(), "type": "Company", "confidence": 0.65}
        for name in dict.fromkeys(_COMPANY_RE.findall(normalized))
    ][:10]
    emails = list(dict.fromkeys(_EMAIL_RE.findall(normalized)))[:10]
    content_hash = f"sha256:{hashlib.sha256(normalized.encode('utf-8')).hexdigest()}"
    return ExtractedMaterial(
        summary=summary,
        entities=entities,
        emails=emails,
        title=document.title[:200],
        source_url=source_url,
        content_hash=content_hash,
    )


def validate_allowed_url(url: str, allowed_domains: set[str]) -> None:
    parsed = urlparse(url)
    if parsed.scheme not in {"https", "http"} or not parsed.hostname:
        raise ValueError("Only public HTTP(S) URLs are allowed")
    hostname = parsed.hostname.lower()
    if hostname in {"localhost", "127.0.0.1", "::1"} or hostname.startswith("10.") or hostname.startswith("192.168."):
        raise ValueError("Private or local URLs are not allowed")
    if allowed_domains and hostname not in allowed_domains:
        raise ValueError("URL domain is not in the crawl allowlist")
