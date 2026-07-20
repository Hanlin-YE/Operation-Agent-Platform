export type VideoAnalysisStatus = "queued" | "processing" | "needs_review" | "failed" | "model_not_configured";

export type VideoAnalysisResult = {
  jobId: string;
  status: VideoAnalysisStatus;
  source: { filename: string; durationSec?: number };
  transcript: { startSec: number; endSec: number; speaker?: string; text: string }[];
  scenes: { startSec: number; endSec: number; summary: string; evidence: string[] }[];
  script?: {
    title: string;
    summary: string;
    beats: { startSec: number; endSec: number; visual: string; narration: string; purpose: string }[];
  };
  warnings: string[];
  error?: string;
};

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

/** Validates the only cross-service contract used by the video-analysis workbench. */
export function parseVideoAnalysisResult(value: unknown): VideoAnalysisResult {
  const data = value as Record<string, unknown>;
  if (!data || typeof data !== "object" || typeof data.jobId !== "string" || !data.source || typeof data.source !== "object" || !Array.isArray(data.transcript) || !Array.isArray(data.scenes) || !Array.isArray(data.warnings)) {
    throw new Error("视频分析服务返回结构不完整。");
  }
  const status = data.status;
  if (!["queued", "processing", "needs_review", "failed", "model_not_configured"].includes(String(status))) throw new Error("视频分析服务返回了未知状态。");
  const source = data.source as Record<string, unknown>;
  if (typeof source.filename !== "string" || (source.durationSec !== undefined && !isNumber(source.durationSec)) || !(data.warnings as unknown[]).every((warning) => typeof warning === "string")) throw new Error("视频分析服务返回结构不完整。");
  const transcript = data.transcript as Record<string, unknown>[];
  const scenes = data.scenes as Record<string, unknown>[];
  if (!transcript.every((item) => isNumber(item.startSec) && isNumber(item.endSec) && item.endSec >= item.startSec && typeof item.text === "string") || !scenes.every((item) => isNumber(item.startSec) && isNumber(item.endSec) && item.endSec >= item.startSec && typeof item.summary === "string" && Array.isArray(item.evidence) && item.evidence.every((entry) => typeof entry === "string"))) throw new Error("视频分析服务返回结构不完整。");
  const script = data.script as Record<string, unknown> | undefined;
  if (status === "needs_review" && (!script || typeof script.title !== "string" || typeof script.summary !== "string" || !Array.isArray(script.beats) || !(script.beats as Record<string, unknown>[]).every((beat) => isNumber(beat.startSec) && isNumber(beat.endSec) && beat.endSec >= beat.startSec && typeof beat.visual === "string" && typeof beat.narration === "string" && typeof beat.purpose === "string"))) throw new Error("视频分析服务返回结构不完整。");
  return data as unknown as VideoAnalysisResult;
}

export function getVideoAnalyzerUrl() {
  return process.env.VIDEO_ANALYZER_BASE_URL?.trim() || `${process.env.AGENT_API_BASE_URL?.trim() || "http://127.0.0.1:8001"}/api/video-analysis`;
}
