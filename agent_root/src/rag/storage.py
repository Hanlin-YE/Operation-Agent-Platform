from __future__ import annotations

import hashlib
from pathlib import Path


class InvalidPdfError(ValueError):
    pass


class LocalDocumentStorage:
    def __init__(self, root: str, max_bytes: int = 50 * 1024 * 1024) -> None:
        self._root = Path(root)
        self._max_bytes = max_bytes

    def save_pdf(self, content: bytes) -> tuple[str, str]:
        if not content.startswith(b"%PDF-"):
            raise InvalidPdfError("uploaded file is not a valid PDF")
        if len(content) > self._max_bytes:
            raise InvalidPdfError("PDF exceeds the 50 MB upload limit")
        checksum = hashlib.sha256(content).hexdigest()
        self._root.mkdir(parents=True, exist_ok=True)
        path = self._root / f"{checksum}.pdf"
        if not path.exists():
            path.write_bytes(content)
        return str(path), checksum
