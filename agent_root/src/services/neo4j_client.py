from __future__ import annotations

from typing import Any


class Neo4jClient:
    """Thin parameterized Cypher adapter; business modules own query selection."""

    def __init__(self, uri: str, username: str, password: str) -> None:
        self._uri = uri
        self._username = username
        self._password = password
        self._driver: Any | None = None

    async def connect(self) -> None:
        from neo4j import AsyncGraphDatabase

        self._driver = AsyncGraphDatabase.driver(self._uri, auth=(self._username, self._password))
        await self._driver.verify_connectivity()

    async def close(self) -> None:
        if self._driver:
            await self._driver.close()
            self._driver = None

    async def run_cypher(self, query: str, parameters: dict[str, Any]) -> list[dict[str, Any]]:
        if not self._driver:
            raise RuntimeError("Neo4j client is not connected")
        async with self._driver.session() as session:
            result = await session.run(query, parameters)
            return [record.data() async for record in result]
