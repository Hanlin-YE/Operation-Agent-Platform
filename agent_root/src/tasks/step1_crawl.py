from __future__ import annotations

from src.processors.cleaner import clean_html
from src.processors.extractor import ExtractedMaterial, compact_document, validate_allowed_url
from src.processors.renderer import render_page


async def crawl_and_extract(url: str, allowed_domains: set[str], timeout_ms: int) -> ExtractedMaterial:
    """Step 1 is deliberately model-free."""
    validate_allowed_url(url, allowed_domains)
    html = await render_page(url, timeout_ms)
    document = clean_html(html)
    return compact_document(document, url)
