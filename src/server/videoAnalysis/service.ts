export type VideoAnalysisStatus = "queued" | "processing" | "needs_review" | "failed" | "model_not_configured";

export type VideoAnalysisResult = {
  jobId: string;
  status: VideoAnalysisStatus;
  step?: string;
  percent?: number;
  message?: string;
  logs?: { at: string; level: "info" | "error"; message: string }[];
  createdAt?: string;
  updatedAt?: string;
  source: { filename: string; sourceUrl?: string; durationSec?: number };
  transcript: { startSec: number; endSec: number; speaker?: string; text: string }[];
  scenes: { startSec: number; endSec: number; summary: string; evidence: string[] }[];
  script?: {
    title: string;
    summary: string;
    storyOutline: string;
    viralBreakdown: { hook: string; structure: string[]; reusablePatterns: string[]; b2bAdaptation: string; risks: string[] };
    beats: { startSec: number; endSec: number; visual: string; narration: string; purpose: string }[];
  };
  warnings: string[];
  error?: string | { code: string; message: string };
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
  if (data.step !== undefined && typeof data.step !== "string") throw new Error("视频分析服务返回结构不完整。");
  if (data.percent !== undefined && (!isNumber(data.percent) || data.percent > 100)) throw new Error("视频分析服务返回结构不完整。");
  if (data.message !== undefined && typeof data.message !== "string") throw new Error("视频分析服务返回结构不完整。");
  if (data.logs !== undefined && (!Array.isArray(data.logs) || !(data.logs as Record<string, unknown>[]).every((log) => typeof log.at === "string" && ["info", "error"].includes(String(log.level)) && typeof log.message === "string"))) throw new Error("视频分析服务返回结构不完整。");
  const source = data.source as Record<string, unknown>;
  if (typeof source.filename !== "string" || (source.sourceUrl !== undefined && typeof source.sourceUrl !== "string") || (source.durationSec !== undefined && !isNumber(source.durationSec)) || !(data.warnings as unknown[]).every((warning) => typeof warning === "string")) throw new Error("视频分析服务返回结构不完整。");
  const transcript = data.transcript as Record<string, unknown>[];
  const scenes = data.scenes as Record<string, unknown>[];
  if (!transcript.every((item) => isNumber(item.startSec) && isNumber(item.endSec) && item.endSec >= item.startSec && typeof item.text === "string") || !scenes.every((item) => isNumber(item.startSec) && isNumber(item.endSec) && item.endSec >= item.startSec && typeof item.summary === "string" && Array.isArray(item.evidence) && item.evidence.every((entry) => typeof entry === "string"))) throw new Error("视频分析服务返回结构不完整。");
  const script = data.script as Record<string, unknown> | undefined;
  const breakdown = script?.viralBreakdown as Record<string, unknown> | undefined;
  if (status === "needs_review" && (!script || typeof script.title !== "string" || typeof script.summary !== "string" || typeof script.storyOutline !== "string" || !breakdown || typeof breakdown.hook !== "string" || !Array.isArray(breakdown.structure) || !breakdown.structure.every((item) => typeof item === "string") || !Array.isArray(breakdown.reusablePatterns) || !breakdown.reusablePatterns.every((item) => typeof item === "string") || typeof breakdown.b2bAdaptation !== "string" || !Array.isArray(breakdown.risks) || !breakdown.risks.every((item) => typeof item === "string") || !Array.isArray(script.beats) || !(script.beats as Record<string, unknown>[]).every((beat) => isNumber(beat.startSec) && isNumber(beat.endSec) && beat.endSec >= beat.startSec && typeof beat.visual === "string" && typeof beat.narration === "string" && typeof beat.purpose === "string"))) throw new Error("视频分析服务返回结构不完整。");
  return data as unknown as VideoAnalysisResult;
}

export function getVideoAnalyzerUrl() {
  return process.env.VIDEO_ANALYZER_BASE_URL?.trim() || `${process.env.AGENT_API_BASE_URL?.trim() || "http://127.0.0.1:8001"}/api/video-analysis`;
}

export function getVideoAnalysisJobsUrl(jobId?: string) {
  return `${getVideoAnalyzerUrl().replace(/\/$/, "")}/jobs${jobId ? `/${encodeURIComponent(jobId)}` : ""}`;
}

export function getVideoAnalysisJobPath(jobId: string) {
  return `/api/video-analysis/jobs/${encodeURIComponent(jobId)}`;
}

export function formatVideoAnalysisClientError(reason: unknown) {
  if (reason instanceof TypeError && /expected pattern|failed to fetch|invalid url/i.test(reason.message)) {
    return "本地视频分析页面仍在使用旧地址，请刷新页面后重试。若仍失败，请确认本地 Agent 运行在 8001 端口。";
  }
  return reason instanceof Error ? reason.message : "视频分析失败。";
}
