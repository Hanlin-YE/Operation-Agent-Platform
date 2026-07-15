from __future__ import annotations

from sqlalchemy import text

from src.database import engine
from src.rag.models import Base


async def initialize_rag_schema() -> None:
    async with engine.begin() as connection:
        await connection.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        await connection.run_sync(Base.metadata.create_all)


async def close_rag_database() -> None:
    await engine.dispose()
