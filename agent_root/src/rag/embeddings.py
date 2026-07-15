from __future__ import annotations

import hashlib
import math
import re
from typing import Protocol


class EmbeddingProvider(Protocol):
    @property
    def dimensions(self) -> int: ...

    @property
    def model_name(self) -> str: ...

    async def embed(self, texts: list[str]) -> list[list[float]]: ...


class DeterministicEmbeddingProvider:
    """Offline development provider; production swaps this for BGE-M3."""

    def __init__(self, dimensions: int = 1024) -> None:
        self._dimensions = dimensions

    @property
    def dimensions(self) -> int:
        return self._dimensions

    @property
    def model_name(self) -> str:
        return f"deterministic-local-{self._dimensions}"

    @staticmethod
    def _tokens(text: str) -> list[str]:
        normalized = text.lower()
        words = re.findall(r"[a-z0-9_.-]+|[\u4e00-\u9fff]", normalized)
        chinese = "".join(token for token in words if len(token) == 1 and "\u4e00" <= token <= "\u9fff")
        return words + [chinese[index : index + 2] for index in range(max(0, len(chinese) - 1))]

    async def embed(self, texts: list[str]) -> list[list[float]]:
        vectors: list[list[float]] = []
        for text in texts:
            vector = [0.0] * self._dimensions
            for token in self._tokens(text):
                digest = hashlib.blake2b(token.encode("utf-8"), digest_size=8).digest()
                index = int.from_bytes(digest[:4], "big") % self._dimensions
                vector[index] += 1.0 if digest[4] % 2 else -1.0
            norm = math.sqrt(sum(value * value for value in vector)) or 1.0
            vectors.append([value / norm for value in vector])
        return vectors


class OpenAICompatibleEmbeddingProvider:
    """Production adapter for BGE-M3 or another OpenAI-compatible embedding service."""

    def __init__(self, *, api_key: str, base_url: str, model: str, dimensions: int = 1024) -> None:
        self._api_key = api_key
        self._base_url = base_url
        self._model = model
        self._dimensions = dimensions

    @property
    def dimensions(self) -> int:
        return self._dimensions

    @property
    def model_name(self) -> str:
        return self._model

    async def embed(self, texts: list[str]) -> list[list[float]]:
        from openai import AsyncOpenAI

        client = AsyncOpenAI(api_key=self._api_key or "local-embedding-service", base_url=self._base_url)
        response = await client.embeddings.create(model=self._model, input=texts)
        vectors = [list(item.embedding) for item in sorted(response.data, key=lambda item: item.index)]
        if any(len(vector) != self._dimensions for vector in vectors):
            raise ValueError(f"Embedding dimension mismatch; expected {self._dimensions}")
        return vectors
