"""Local video evidence pipeline inspired by the open-source video-analyzer workflow.

The endpoint deliberately separates extraction from interpretation: Whisper and
PySceneDetect create traceable evidence first; only a configured shared model
turns that evidence into a reviewable script package.
"""
from __future__ import annotations

import asyncio
import os
import shutil
import subprocess
import tempfile
import uuid
from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from src.api.rag_routes import _read_multipart
from src.services.llm_provider import GraphContext

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
    beats: list[ScriptBeat]


def _enabled() -> bool:
    return os.getenv("VIDEO_ANALYZER_ENABLED", "false").lower() in {"1", "true", "yes"}


def _duration(path: Path) -> float | None:
    try:
        output = subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", str(path)], text=True, timeout=20)
        return round(float(output.strip()), 2)
    except (FileNotFoundError, subprocess.SubprocessError, ValueError):
        return None


def _extract(path: Path) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    try:
        from faster_whisper import WhisperModel
        from scenedetect import ContentDetector, detect
    except ImportError as exc:
        raise RuntimeError("缺少视频分析依赖；请安装 agent_root/requirements.txt。") from exc
    if not shutil.which("ffmpeg"):
        raise RuntimeError("未检测到 ffmpeg，无法读取视频音轨。")
    model = WhisperModel(os.getenv("VIDEO_WHISPER_MODEL", "small"), device=os.getenv("VIDEO_WHISPER_DEVICE", "auto"), compute_type=os.getenv("VIDEO_WHISPER_COMPUTE_TYPE", "int8"))
    segments, _ = model.transcribe(str(path), language="zh", vad_filter=True)
    transcript = [{"startSec": round(segment.start, 2), "endSec": round(segment.end, 2), "text": segment.text.strip()} for segment in segments if segment.text.strip()]
    cuts = detect(str(path), ContentDetector(threshold=float(os.getenv("VIDEO_SCENE_THRESHOLD", "27"))))
    scenes = [{"startSec": round(start.get_seconds(), 2), "endSec": round(end.get_seconds(), 2), "summary": f"检测到的镜头段落 {index + 1}", "evidence": ["场景切分"]} for index, (start, end) in enumerate(cuts)]
    return transcript, scenes


@router.post("")
async def analyze_video(request: Request) -> dict[str, object]:
    if not _enabled():
        raise HTTPException(status_code=503, detail="视频分析服务尚未启用。请配置 VIDEO_ANALYZER_ENABLED=true 并安装本地依赖。")
    fields, files = await _read_multipart(request)
    if len(files) != 1 or str(files[0].get("name")) != "video":
        raise HTTPException(status_code=422, detail="请上传一个名为 video 的视频文件。")
    file = files[0]
    content = bytes(file["content"])
    max_bytes = int(os.getenv("VIDEO_ANALYSIS_MAX_BYTES", str(300 * 1024 * 1024)))
    if not content or len(content) > max_bytes:
        raise HTTPException(status_code=422, detail="视频文件为空或超过大小限制。")
    filename = Path(str(file.get("filename") or "video.mp4")).name
    if Path(filename).suffix.lower() not in {".mp4", ".mov", ".webm"}:
        raise HTTPException(status_code=415, detail="仅支持 MP4、MOV 或 WebM 视频。")
    with tempfile.TemporaryDirectory(prefix="video-analysis-") as directory:
        path = Path(directory) / filename
        path.write_bytes(content)
        try:
            transcript, scenes = await asyncio.to_thread(_extract, path)
        except RuntimeError as exc:
            raise HTTPException(status_code=503, detail=str(exc)) from exc
        source = {"filename": filename, "durationSec": _duration(path)}
    evidence = {"source": source, "transcript": transcript, "scenes": scenes}
    if not os.getenv("OPENAI_API_KEY", "").strip():
        return {"jobId": f"video-{uuid.uuid4().hex[:12]}", "status": "model_not_configured", **evidence, "warnings": ["已提取转写和场景边界；未配置统一模型，尚未生成剧本。", "场景标签仅表示切分结果，不代表视觉语义判断。"]}
    try:
        script = await request.app.state.llm_provider.generate_json(
            GraphContext(evidence=[evidence]),
            ScriptPackage,
            "根据转写和镜头边界生成中文可编辑视频剧本。只根据给出的证据陈述，无法确认的视觉内容应明确写为待人工核验；每段必须包含时间、画面、台词和段落目的。",
        )
    except Exception as exc:  # provider errors must not become invented scripts
        raise HTTPException(status_code=502, detail=f"统一模型未能整理视频证据：{exc}") from exc
    return {"jobId": f"video-{uuid.uuid4().hex[:12]}", "status": "needs_review", **evidence, "script": script.model_dump(), "warnings": ["剧本基于自动转写和场景切分生成；请人工核验画面描述、专有名词与时间轴。"]}
