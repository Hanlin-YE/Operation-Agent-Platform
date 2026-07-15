from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class CleanDocument:
    title: str
    headings: list[str]
    links: list[str]
    text: str


def clean_html(html: str) -> CleanDocument:
    """Remove non-content DOM before any downstream processing.

    This function is intentionally local-only. Its return type is not accepted
    by the LLM client; extractor.compact_document must run next.
    """
    from bs4 import BeautifulSoup

    soup = BeautifulSoup(html, "lxml")
    for node in soup(["script", "style", "noscript", "svg", "nav", "footer", "header", "form", "iframe"]):
        node.decompose()
    title = soup.title.get_text(" ", strip=True) if soup.title else ""
    headings = [node.get_text(" ", strip=True) for node in soup.find_all(["h1", "h2", "h3"])][:20]
    links = [str(node.get("href")) for node in soup.find_all("a", href=True)][:50]
    text = " ".join(soup.stripped_strings)
    return CleanDocument(title=title, headings=headings, links=links, text=text)
