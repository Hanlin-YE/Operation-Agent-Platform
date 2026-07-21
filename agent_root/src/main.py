from __future__ import annotations

import asyncio
import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from dotenv import load_dotenv

from src.api.rag_routes import router as rag_router
from src.api.market_research_routes import router as market_research_router
from src.api.video_analysis_routes import router as video_analysis_router, setup_video_analysis_jobs
from src.api.v1_routes import graph_router, router as runs_router
from src.core.run_service import RunService
from src.services.dingtalk_client import InMemoryDingTalkClient
from src.services.knowledge_graph import KnowledgeGraphService
from src.services.llm_provider import LlmProviderConfig, create_llm_provider
from src.services.neo4j_client import Neo4jClient
from src.rag.embeddings import DeterministicEmbeddingProvider, OpenAICompatibleEmbeddingProvider
from src.rag.parsers import DeferredScientificDocumentParser
from src.rag.repository import InMemoryRagRepository
from src.rag.service import RagService
from src.rag.storage import LocalDocumentStorage
from src.tasks.task_runner import TaskRunner
from src.tasks.run_pipeline import process_next_run


# Docker injects this file through compose; load it here too for direct local
# uvicorn runs, while preserving explicit shell environment overrides.
load_dotenv(Path(__file__).resolve().parents[1] / ".env", override=False)


def _provider_from_environment():
    provider_name = os.getenv("LLM_PROVIDER", "").strip()
    api_key = os.getenv("LLM_API_KEY", "").strip() or os.getenv("OPENAI_API_KEY", "").strip()
    model = os.getenv("LLM_MODEL", "").strip() or os.getenv("OPENAI_MODEL", "").strip()
    if api_key and model and not provider_name:
        provider_name = "openai_compatible"
    base_url = os.getenv("LLM_BASE_URL", "").strip() or os.getenv("OPENAI_BASE_URL", "").strip() or "https://api.openai.com/v1"
    api_mode = os.getenv("LLM_API_MODE", "chat_completions").strip().lower()
    # The Next app accepts a full Chat Completions URL; the Python SDK expects
    # the API root instead, so normalize the shared environment value.
    if base_url.rstrip("/").endswith("/chat/completions"):
        base_url = base_url.rstrip("/")[: -len("/chat/completions")]
    if not provider_name and not api_key and not model:
        return create_llm_provider(
            LlmProviderConfig(provider="local_demo", api_key="", base_url="", model="local-demo-v1")
        )
    missing = [name for name, value in (("LLM_PROVIDER", provider_name), ("LLM_API_KEY", api_key), ("LLM_MODEL", model)) if not value]
    if missing:
        raise RuntimeError(f"Incomplete LLM Provider configuration: {', '.join(missing)}")
    return create_llm_provider(
        LlmProviderConfig(provider=provider_name, api_key=api_key, base_url=base_url, model=model, api_mode=api_mode)
    )


def _embedding_provider_from_environment():
    provider_name = os.getenv("EMBEDDING_PROVIDER", "deterministic_local").strip()
    dimensions = int(os.getenv("EMBEDDING_DIMENSIONS", "1024"))
    if provider_name == "deterministic_local":
        return DeterministicEmbeddingProvider(dimensions=dimensions)
    if provider_name == "openai_compatible":
        base_url = os.getenv("EMBEDDING_BASE_URL", "").strip()
        model = os.getenv("EMBEDDING_MODEL", "BAAI/bge-m3").strip()
        if not base_url:
            raise RuntimeError("EMBEDDING_BASE_URL is required for openai_compatible embeddings")
        return OpenAICompatibleEmbeddingProvider(
            api_key=os.getenv("EMBEDDING_API_KEY", "").strip(),
            base_url=base_url,
            model=model,
            dimensions=dimensions,
        )
    raise RuntimeError(f"Unsupported embedding provider: {provider_name}")


def create_app(*, start_runner: bool = True, initialize_graph: bool | None = None) -> FastAPI:
    """Create the API application.

    External services are intentionally not started in contract tests.  Runtime
    deployments keep graph initialization enabled; passing ``start_runner=False``
    creates a dependency-free application unless explicitly overridden.
    """
    if initialize_graph is None:
        initialize_graph = start_runner

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        app.state.runner_enabled = start_runner
        runner_task: asyncio.Task[None] | None = None
        runner: TaskRunner | None = None
        graph_service = app.state.graph_service
        initialize = getattr(graph_service, "initialize", None)
        if initialize_graph and initialize:
            await initialize()
        if start_runner:
            from src.database import session_factory
            from src.rag.postgres_repository import PostgresRagRepository
            from src.rag.schema import initialize_rag_schema

            await initialize_rag_schema()
            app.state.rag_service = RagService(PostgresRagRepository(session_factory), app.state.embedding_provider)
        if start_runner:
            runner = TaskRunner(poll_interval_seconds=1, concurrency=1)

            async def poll_once() -> None:
                await process_next_run(app.state.control_plane, app.state.llm_provider)

            runner_task = asyncio.create_task(runner.run(poll_once))
        try:
            yield
        finally:
            if runner:
                runner.stop()
            if runner_task:
                await runner_task
            close = getattr(graph_service, "close", None)
            if initialize_graph and close:
                await close()
            if start_runner:
                from src.rag.schema import close_rag_database

                await close_rag_database()

    app = FastAPI(title="AIGC Operations Acquisition and Retention Agent", version="4.0.0", lifespan=lifespan)
    app.state.control_plane = InMemoryDingTalkClient()
    app.state.run_service = RunService(app.state.control_plane)
    app.state.llm_provider = _provider_from_environment()
    app.state.embedding_provider = _embedding_provider_from_environment()
    app.state.rag_service = RagService(InMemoryRagRepository(), app.state.embedding_provider)
    app.state.document_storage = LocalDocumentStorage(os.getenv("RAG_STORAGE_PATH", "/data/rag"))
    app.state.document_parser = DeferredScientificDocumentParser()
    app.state.graph_service = KnowledgeGraphService(
        Neo4jClient(
            os.getenv("NEO4J_URI", "bolt://localhost:7687"),
            os.getenv("NEO4J_USERNAME", "neo4j"),
            os.getenv("NEO4J_PASSWORD", "change-me"),
        )
    )
    app.include_router(runs_router)
    app.include_router(graph_router)
    app.include_router(rag_router)
    app.include_router(market_research_router)
    app.include_router(video_analysis_router)
    setup_video_analysis_jobs(app)

    @app.get("/healthz", tags=["system"])
    def healthz() -> dict[str, str]:
        return {"status": "ok"}

    return app


app = create_app()
