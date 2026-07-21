"""Local video evidence pipeline inspired by the open-source video-analyzer workflow.

The endpoint deliberately separates extraction from interpretation: Whisper and
PySceneDetect create traceable evidence first; only a configured shared model
turns that evidence into a reviewable script package.
"""
from __future__ import annotations

import asyncio
import ipaddress
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

import httpx
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from src.api.rag_routes import _read_multipart
from src.services.llm_provider import GraphContext
from src.services.video_analysis_jobs import VideoAnalysisJobStore

router = APIRouter(prefix="/api/video-analysis", tags=["video-analysis"])


class TranscriptSegment(BaseModel):
    startSec: float = Field(ge=0)
    endSec: float = Field(ge=0)
    speaker: str | None = None
    text: str


class Scene(BaseModel):
    startSec: float = Field(ge=0)
    endSec: float = Field(ge=0)
    summary: str
    evidence: list[str]


class ScriptBeat(BaseModel):
    startSec: float = Field(ge=0)
    endSec: float = Field(ge=0)
    visual: str
    narration: str
    purpose: str


class ScriptPackage(BaseModel):
    title: str
    summary: str
    storyOutline: str
    viralBreakdown: "ViralBreakdown"
    beats: list[ScriptBeat]


class ViralBreakdown(BaseModel):
    hook: str
    structure: list[str]
    reusablePatterns: list[str]
    b2bAdaptation: str
    risks: list[str]


def _enabled() -> bool:
    return os.getenv("VIDEO_ANALYZER_ENABLED", "false").lower() in {"1", "true", "yes"}


def _duration(path: Path) -> float | None:
    try:
        output = subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", str(path)], text=True, timeout=20)
        return round(float(output.strip()), 2)
    except (FileNotFoundError, subprocess.SubprocessError, ValueError):
        return None


def _load_whisper_model() -> Any:
    try:
        from faster_whisper import WhisperModel
    except ImportError as exc:
        raise RuntimeError("缺少视频分析依赖；请安装 agent_root/requirements.txt。") from exc
    if not shutil.which("ffmpeg"):
        raise RuntimeError("未检测到 ffmpeg，无法读取视频音轨。")
    model_name = _whisper_model_reference()
    if Path(model_name).is_absolute() and not Path(model_name).exists():
        raise RuntimeError("本地 Whisper 模型目录不存在。请检查 VIDEO_WHISPER_MODEL，或设置 HF_ENDPOINT 使用可访问的镜像。")
    try:
        return WhisperModel(model_name, device=os.getenv("VIDEO_WHISPER_DEVICE", "auto"), compute_type=os.getenv("VIDEO_WHISPER_COMPUTE_TYPE", "int8"))
    except Exception as exc:
        endpoint = os.getenv("HF_ENDPOINT", "https://huggingface.co")
        raise RuntimeError(f"模型下载或加载失败。请检查网络/HF_ENDPOINT（当前：{endpoint}），或把 VIDEO_WHISPER_MODEL 指向本地模型目录。{exc}") from exc


def _whisper_model_reference() -> str:
    """Prefer the project-local model downloaded for offline operations."""
    configured = os.getenv("VIDEO_WHISPER_MODEL", "").strip()
    if configured:
        return configured
    local_model = Path(__file__).resolve().parents[2] / "models" / "faster-whisper-small"
    return str(local_model) if local_model.exists() else "small"


def _transcribe(model: Any, path: Path) -> list[dict[str, Any]]:
    segments, _ = model.transcribe(str(path), language="zh", vad_filter=True)
    return [{"startSec": round(segment.start, 2), "endSec": round(segment.end, 2), "text": segment.text.strip()} for segment in segments if segment.text.strip()]


def _detect_scenes(path: Path) -> list[dict[str, Any]]:
    try:
        from scenedetect import ContentDetector, detect
    except ImportError as exc:
        raise RuntimeError("缺少视频分析依赖；请安装 agent_root/requirements.txt。") from exc
    cuts = detect(str(path), ContentDetector(threshold=float(os.getenv("VIDEO_SCENE_THRESHOLD", "27"))))
    return [{"startSec": round(start.get_seconds(), 2), "endSec": round(end.get_seconds(), 2), "summary": f"检测到的镜头段落 {index + 1}", "evidence": ["场景切分"]} for index, (start, end) in enumerate(cuts)]


def validate_public_video_url(url: str) -> str:
    """Permit only public HTTP(S) URLs; literal private IPs are never valid sources."""
    parsed = urlparse(url.strip())
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        raise ValueError("仅支持公开 HTTP(S) 视频链接。")
    try:
        address = ipaddress.ip_address(parsed.hostname)
        if not address.is_global:
            raise ValueError("不允许访问本机、内网或保留地址。")
    except ValueError as exc:
        if str(exc) == "不允许访问本机、内网或保留地址。":
            raise
    return parsed.geturl()


def is_supported_platform_video_url(url: str) -> bool:
    hostname = (urlparse(url).hostname or "").lower()
    return hostname == "b23.tv" or hostname.endswith(".bilibili.com") or hostname == "bilibili.com"


async def _download_supported_platform_video(url: str, directory: Path, max_bytes: int) -> tuple[Path, dict[str, object]]:
    """Resolve only Bilibili public pages; no cookies, login bypass, or paywall handling."""
    output_template = str(directory / "platform-video.%(ext)s")
    command = [
        sys.executable, "-m", "yt_dlp", "--no-playlist", "--no-warnings", "--max-filesize", f"{max_bytes // (1024 * 1024)}M",
        "--merge-output-format", "mp4", "--print", "after_move:filepath", "-o", output_template, url,
    ]
    try:
        result = await asyncio.to_thread(subprocess.run, command, capture_output=True, text=True, timeout=180)
    except (OSError, subprocess.TimeoutExpired) as exc:
        raise ValueError("平台视频解析器暂不可用，请改为上传已授权的视频文件。") from exc
    if result.returncode != 0:
        raise ValueError("平台视频无法解析；若内容需要登录、地区权限或付费权限，请使用授权导入或本地上传。")
    candidates = [Path(line.strip()) for line in result.stdout.splitlines() if line.strip()]
    path = next((candidate for candidate in reversed(candidates) if candidate.exists() and candidate.is_file()), None)
    if not path or path.stat().st_size <= 0:
        raise ValueError("平台视频解析后未得到可用文件，请改为上传已授权的视频文件。")
    if path.stat().st_size > max_bytes:
        raise ValueError("平台视频超过 300MB 限制。")
    return path, {"filename": path.name, "sourceUrl": url}


async def _download_public_video(url: str, directory: Path, max_bytes: int) -> tuple[Path, dict[str, object]]:
    current_url = validate_public_video_url(url)
    if is_supported_platform_video_url(current_url):
        return await _download_supported_platform_video(current_url, directory, max_bytes)
    timeout = httpx.Timeout(connect=10, read=30, write=30, pool=10)
    async with httpx.AsyncClient(follow_redirects=False, timeout=timeout) as client:
        for _ in range(4):
            async with client.stream("GET", current_url, headers={"User-Agent": "FrictionX-ContentResearch/1.0"}) as response:
                if response.status_code in {301, 302, 303, 307, 308}:
                    location = response.headers.get("location")
                    if not location:
                        raise ValueError("视频链接重定向地址无效。")
                    current_url = validate_public_video_url(str(httpx.URL(current_url).join(location)))
                    continue
                if response.status_code >= 400:
                    raise ValueError(f"视频链接无法访问（HTTP {response.status_code}）。")
                content_type = response.headers.get("content-type", "").split(";", 1)[0].lower()
                if content_type and not content_type.startswith("video/") and content_type != "application/octet-stream":
                    if is_supported_platform_video_url(current_url):
                        return await _download_supported_platform_video(current_url, directory, max_bytes)
                    raise ValueError("链接未返回视频文件，请上传视频或提供可直接访问的视频链接。")
                name = Path(urlparse(current_url).path).name or "reference-video.mp4"
                if Path(name).suffix.lower() not in {".mp4", ".mov", ".webm"}:
                    name = f"{name}.mp4"
                path = directory / name
                total = 0
                with path.open("wb") as output:
                    async for chunk in response.aiter_bytes():
                        total += len(chunk)
                        if total > max_bytes:
                            raise ValueError("远程视频超过 300MB 限制。")
                        output.write(chunk)
                if not total:
                    raise ValueError("远程视频为空。")
                return path, {"filename": name, "sourceUrl": current_url}
    raise ValueError("视频链接重定向次数过多。")


def setup_video_analysis_jobs(app: Any) -> None:
    """Called during app startup so interrupted jobs are recovered deterministically."""
    app.state.video_analysis_job_store = VideoAnalysisJobStore()


def _job_store(request: Request) -> VideoAnalysisJobStore:
    store = getattr(request.app.state, "video_analysis_job_store", None)
    if store is None:
        store = VideoAnalysisJobStore()
        request.app.state.video_analysis_job_store = store
    return store


async def _run_job(request: Request, job_id: str, directory: Path, source_url: str | None) -> None:
    store = _job_store(request)
    max_bytes = int(os.getenv("VIDEO_ANALYSIS_MAX_BYTES", str(300 * 1024 * 1024)))
    try:
        store.update(job_id, status="processing", step="准备本地模型", percent=12, message="正在检查或下载 Whisper 本地模型缓存。")
        model = await asyncio.to_thread(_load_whisper_model)
        store.update(job_id, step="解析/下载视频", percent=28, message="正在解析公开视频链接或读取上传文件。")
        if source_url:
            path, source = await _download_public_video(source_url, directory, max_bytes)
            store.update(job_id, source=source)
        else:
            candidates = list(directory.iterdir())
            path = next((item for item in candidates if item.is_file()), None)
            if not path:
                raise ValueError("上传临时文件不存在，任务无法继续。")
            source = {"filename": path.name}
        source["durationSec"] = _duration(path)
        store.update(job_id, source=source, step="转写", percent=45, message="正在从视频中提取台词时间轴。")
        transcript = await asyncio.to_thread(_transcribe, model, path)
        store.update(job_id, transcript=transcript, step="场景切分", percent=68, message="正在检测镜头边界并整理证据。")
        scenes = await asyncio.to_thread(_detect_scenes, path)
        evidence = {"source": source, "transcript": transcript, "scenes": scenes}
        store.update(job_id, scenes=scenes)
        api_key = os.getenv("LLM_API_KEY", "").strip() or os.getenv("OPENAI_API_KEY", "").strip()
        model_name = os.getenv("LLM_MODEL", "").strip() or os.getenv("OPENAI_MODEL", "").strip()
        if not api_key or not model_name:
            store.update(job_id, status="model_not_configured", step="等待 LLM 配置", percent=82,
                         message="证据提取完成；尚未配置兼容 LLM，未生成策略结论。", warnings=["已保留转写和场景证据。请配置 LLM_PROVIDER、LLM_API_KEY、LLM_MODEL（Ollama/LM Studio 可使用兼容端点）。", "场景标签仅表示切分结果，不代表视觉语义判断。"])
            return
        store.update(job_id, step="拉片结构分析", percent=82, message="正在基于证据生成故事大纲、爆点结构和分镜。")
        try:
            script = await request.app.state.llm_provider.generate_json(
                GraphContext(evidence=[evidence]), ScriptPackage,
                "根据转写和镜头边界生成中文可编辑视频剧本与爆款拉片结论。只根据给出的证据陈述，无法确认的视觉内容应明确写为待人工核验；每段必须包含时间、画面、台词和段落目的。额外输出 storyOutline，以及 viralBreakdown：hook、structure、reusablePatterns、b2bAdaptation、risks。不得照抄原视频文案，不得把原视频的性能说法当作我方承诺。",
            )
        except Exception as exc:
            raise RuntimeError(f"LLM 拉片结构分析失败：{exc}") from exc
        store.update(job_id, status="needs_review", step="等待人工审核", percent=100, message="拉片完成，等待人工审核后载入内容策略。", script=script.model_dump(), warnings=["剧本基于自动转写和场景切分生成；请人工核验画面描述、专有名词与时间轴。"])
    except Exception as exc:
        message = str(exc) or "视频分析任务失败。"
        store.update(job_id, status="failed", step="处理失败", message=message, log_level="error", error={"code": "video_analysis_failed", "message": message})
    finally:
        # Keep only text evidence and review results, never the original source video.
        shutil.rmtree(directory, ignore_errors=True)


async def _create_video_job(request: Request) -> dict[str, object]:
    if not _enabled():
        raise HTTPException(status_code=503, detail="视频分析服务尚未启用。请配置 VIDEO_ANALYZER_ENABLED=true 并安装本地依赖。")
    fields, files = await _read_multipart(request)
    source_url = fields.get("source_url", "").strip()
    uploaded_file = files[0] if len(files) == 1 and str(files[0].get("name")) == "video" else None
    if bool(uploaded_file) == bool(source_url):
        raise HTTPException(status_code=422, detail="请上传一个视频或提供一个公开视频链接。")
    max_bytes = int(os.getenv("VIDEO_ANALYSIS_MAX_BYTES", str(300 * 1024 * 1024)))
    if source_url:
        try:
            validate_public_video_url(source_url)
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc
        source: dict[str, object] = {"filename": "待下载公开视频", "sourceUrl": source_url}
    else:
        content = bytes(uploaded_file["content"])
        if not content or len(content) > max_bytes:
            raise HTTPException(status_code=422, detail="视频文件为空或超过大小限制。")
        filename = Path(str(uploaded_file.get("filename") or "video.mp4")).name
        if Path(filename).suffix.lower() not in {".mp4", ".mov", ".webm"}:
            raise HTTPException(status_code=415, detail="仅支持 MP4、MOV 或 WebM 视频。")
        source = {"filename": filename}
    job = _job_store(request).create(source)
    directory = Path(tempfile.mkdtemp(prefix=f"video-analysis-{job['jobId']}-"))
    if uploaded_file:
        (directory / str(source["filename"])).write_bytes(bytes(uploaded_file["content"]))
    asyncio.create_task(_run_job(request, str(job["jobId"]), directory, source_url or None))
    return job


@router.post("/jobs")
async def create_video_job(request: Request) -> dict[str, object]:
    return await _create_video_job(request)


@router.get("/jobs/{job_id}")
async def get_video_job(request: Request, job_id: str) -> dict[str, object]:
    job = _job_store(request).get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="未找到该视频拉片任务。")
    return job


@router.post("")
async def analyze_video(request: Request) -> dict[str, object]:
    """Legacy entry point retained while callers migrate to /jobs."""
    return await _create_video_job(request)
