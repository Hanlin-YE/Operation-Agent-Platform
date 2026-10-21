"""Read the same protected configuration as the local Next.js application."""
import json
import hmac
import hashlib
import os
from pathlib import Path
from src.services.llm_provider import LlmProviderConfig, create_llm_provider


def video_provider(snapshot: dict | None = None):
    root = Path(os.getenv("LOCAL_DATA_DIR") or Path(__file__).resolve().parents[3] / "data")
    file = root / "model-settings.json"
    if not file.exists():
        if snapshot:
            # Node's legacy environment profile: same env is required until saved in Settings.
            key = os.getenv("LLM_API_KEY") or os.getenv("OPENAI_API_KEY")
            if not key:
                raise RuntimeError("请在本地设置保存模型配置，使视频服务读取同一密钥。")
            profile = {**snapshot, "apiKey": key}
        else:
            return None
    else:
        data = json.loads(file.read_text(encoding="utf-8"))
        profile_id = snapshot.get("id") if snapshot else data["features"]["video"]
        profile = next((p for p in data["profiles"] if p["id"] == profile_id), None)
        if not profile or not profile.get("apiKey"):
            raise RuntimeError("视频模型配置不完整，请在本地设置保存服务地址、模型名称与密钥。")
        profile = {**profile, **(snapshot or {})}
    return create_llm_provider(LlmProviderConfig(
        provider="openai_compatible", api_key=profile["apiKey"],
        base_url=profile["baseUrl"].rstrip("/").removesuffix("/chat/completions").removesuffix("/responses"),
        model=profile["model"], api_mode=profile.get("apiMode", "chat_completions"),
        timeout_seconds=profile.get("timeoutMs",60000)/1000,
        temperature=profile.get("temperature",0.3), max_tokens=profile.get("maxTokens",4096),
    ))


def verify_model_snapshot(raw: str, signature: str) -> dict:
    snapshot = json.loads(raw)
    if not isinstance(snapshot, dict) or "apiKey" in snapshot:
        raise ValueError("视频模型快照格式无效")
    provider = video_provider(snapshot)
    if provider is None:
        raise ValueError("请先在本地设置保存视频模型")
    expected = hmac.new(provider._config.api_key.encode(), raw.encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, signature):
        raise ValueError("视频模型配置校验失败，请确认 Web 与 Agent 使用同一 LOCAL_DATA_DIR 并重新提交任务。")
    return snapshot
