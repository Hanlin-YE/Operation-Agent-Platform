from __future__ import annotations

import argparse
import asyncio
import os
from pathlib import Path

from dotenv import load_dotenv

from src.services.neo4j_client import Neo4jClient
from src.services.xiaohongshu_graph_importer import import_xiaohongshu_leads_to_neo4j


def _args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Import a public Xiaohongshu lead workbook into the Neo4j sales graph.")
    parser.add_argument("xlsx_path", type=Path, help="Path to 小红书公开线索表 .xlsx")
    parser.add_argument("--uri", default=None, help="Neo4j Bolt URI. Defaults to NEO4J_URI or bolt://localhost:7687")
    parser.add_argument("--username", default=None, help="Neo4j username. Defaults to NEO4J_USERNAME or neo4j")
    parser.add_argument("--password", default=None, help="Neo4j password. Defaults to NEO4J_PASSWORD")
    return parser.parse_args()


async def _main() -> None:
    env_path = Path(__file__).resolve().parents[1] / ".env"
    load_dotenv(env_path, override=False)
    args = _args()
    uri = args.uri or os.getenv("NEO4J_URI", "bolt://localhost:7687")
    username = args.username or os.getenv("NEO4J_USERNAME", "neo4j")
    password = args.password or os.getenv("NEO4J_PASSWORD", "")
    if not password:
        raise SystemExit("Missing Neo4j password. Set NEO4J_PASSWORD or pass --password.")

    client = Neo4jClient(uri, username, password)
    await client.connect()
    try:
        counts = await import_xiaohongshu_leads_to_neo4j(client, args.xlsx_path)
    finally:
        await client.close()

    print(f"Imported {counts['entities']} entities and {counts['relationships']} relationships into Neo4j.")


if __name__ == "__main__":
    asyncio.run(_main())
