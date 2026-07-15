from __future__ import annotations


def chunk_pages(text: str, max_chars: int = 1800) -> list[tuple[int, str]]:
    chunks: list[tuple[int, str]] = []
    for page_number, page in enumerate(text.split("\f"), start=1):
        paragraphs = [part.strip() for part in page.split("\n\n") if part.strip()]
        if not paragraphs and page.strip():
            paragraphs = [page.strip()]
        buffer = ""
        for paragraph in paragraphs:
            if buffer and len(buffer) + len(paragraph) + 2 > max_chars:
                chunks.append((page_number, buffer))
                buffer = ""
            if len(paragraph) <= max_chars:
                buffer = f"{buffer}\n\n{paragraph}".strip()
            else:
                if buffer:
                    chunks.append((page_number, buffer))
                    buffer = ""
                for start in range(0, len(paragraph), max_chars):
                    chunks.append((page_number, paragraph[start : start + max_chars]))
        if buffer:
            chunks.append((page_number, buffer))
    return chunks
