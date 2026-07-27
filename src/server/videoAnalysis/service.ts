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

export type VideoReferenceScoreDimension = {
  id: "continuity" | "innovation" | "storyboard" | "adaptation";
  label: string;
  score: number;
  verdict: string;
  evidence: string;
  feedback: string;
  revisionAction: string;
};

export type VideoReferenceBeatScore = {
  label: string;
  timeRange: string;
  score: number;
  verdict: string;
  evidence: string;
};

export type VideoReferenceScoreReport = {
  score: number;
  level: "high" | "medium" | "low";
  verdict: string;
  dimensions: VideoReferenceScoreDimension[];
  beatScores: VideoReferenceBeatScore[];
  revisionActions: string[];
};

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function clipScore(value: number) {
  return Math.max(30, Math.min(98, Math.round(value)));
}

function compact(value: string, max = 72) {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > max ? `${normalized.slice(0, max)}...` : normalized;
}

function containsAny(text: string, terms: string[]) {
  return terms.some((term) => text.includes(term));
}

function scoreClass(score: number) {
  if (score >= 85) return "high";
  if (score >= 72) return "medium";
  return "low";
}

function timeRange(startSec: number, endSec: number) {
  return `${startSec.toFixed(1)}-${endSec.toFixed(1)} 秒`;
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

export function validateVideoSourceUrl(value: string) {
  const sourceUrl = value.trim();
  if (!sourceUrl) return "";
  let parsed: URL;
  try {
    parsed = new URL(sourceUrl);
  } catch {
    throw new Error("请输入完整的公开视频链接，例如 https://b23.tv/xxxx 或可直接访问的 MP4/MOV/WebM 地址。");
  }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("仅支持 HTTP(S) 公开视频链接。");
  }
  return parsed.toString();
}

export function buildVideoReferenceScore(result: VideoAnalysisResult): VideoReferenceScoreReport | null {
  if (!result.script) return null;
  const { script } = result;
  const beats = script.beats;
  const fullText = [
    script.summary,
    script.storyOutline,
    script.viralBreakdown.hook,
    script.viralBreakdown.structure.join(" "),
    script.viralBreakdown.reusablePatterns.join(" "),
    script.viralBreakdown.b2bAdaptation,
    beats.map((beat) => `${beat.visual} ${beat.narration} ${beat.purpose}`).join(" ")
  ].join("\n");
  const continuityTerms = ["引入", "转折", "承接", "铺垫", "回到", "总结", "递进", "对比", "解决"];
  const innovationTerms = ["反差", "钩子", "可视化", "记忆点", "冲突", "爆点", "问题", "对比", "概念"];
  const b2bTerms = ["B 端", "客户", "工况", "测试", "样机", "选型", "风险", "证据", "场景", "采购"];

  const continuityScore = clipScore(46 + beats.length * 5 + script.viralBreakdown.structure.length * 5 + (containsAny(fullText, continuityTerms) ? 12 : 0));
  const innovationScore = clipScore(44 + script.viralBreakdown.reusablePatterns.length * 8 + (containsAny(`${script.viralBreakdown.hook} ${fullText}`, innovationTerms) ? 16 : 0));
  const storyboardScore = clipScore(44 + beats.length * 6 + beats.filter((beat) => beat.endSec > beat.startSec && beat.visual && beat.narration && beat.purpose).length * 6 + Math.min(result.scenes.length, 6) * 2);
  const adaptationScore = clipScore(44 + script.viralBreakdown.risks.length * 6 + (containsAny(script.viralBreakdown.b2bAdaptation, b2bTerms) ? 18 : 0) + (result.warnings.length ? 4 : 0));

  const dimensions: VideoReferenceScoreDimension[] = [
    {
      id: "continuity",
      label: "故事连续性",
      score: continuityScore,
      verdict: continuityScore >= 85 ? "连续性强" : continuityScore >= 72 ? "基本连贯" : "承接不足",
      evidence: compact(script.storyOutline),
      feedback: continuityScore >= 72 ? "故事大纲和段落目的能解释内容推进关系，可作为策略样本继续复用。" : "拆分结果还没有清楚说明每段如何进入下一段，需要人工补足承接。",
      revisionAction: "补清开场、解释、证明和行动之间的过渡句。"
    },
    {
      id: "innovation",
      label: "创新性",
      score: innovationScore,
      verdict: innovationScore >= 85 ? "有记忆点" : innovationScore >= 72 ? "表达有亮点" : "爆点偏常规",
      evidence: compact(script.viralBreakdown.hook),
      feedback: innovationScore >= 72 ? "开场钩子和可复用规律已经给出可转译的表达方式。" : "钩子还偏描述性，需要把核心冲突或视觉反差提到前三秒。",
      revisionAction: "把一个可视化对比、反差问题或结果前后变化放进开场。"
    },
    {
      id: "storyboard",
      label: "分镜专业性",
      score: storyboardScore,
      verdict: storyboardScore >= 85 ? "拆分可执行" : storyboardScore >= 72 ? "拆分基本可用" : "镜头约束不足",
      evidence: compact(beats[0] ? `${timeRange(beats[0].startSec, beats[0].endSec)} ${beats[0].visual}` : script.summary),
      feedback: storyboardScore >= 72 ? "逐段包含时间、画面、台词和段落目的，能支撑内容策略复盘。" : "部分片段缺少画面、台词或目的，进入策略复用前需要人工校准。",
      revisionAction: "逐段核对时间轴、画面主体、台词摘要和段落目的。"
    },
    {
      id: "adaptation",
      label: "内容适配度",
      score: adaptationScore,
      verdict: adaptationScore >= 85 ? "B 端转译明确" : adaptationScore >= 72 ? "具备转译方向" : "业务适配不足",
      evidence: compact(script.viralBreakdown.b2bAdaptation),
      feedback: adaptationScore >= 72 ? "已把参考视频拆成可用于 B2B 内容策略的改写方向，并保留风险提醒。" : "B 端应用、证据要求或风险边界还不够明确。",
      revisionAction: "补充目标行业、应用工况、证据口径和不可复用的原片承诺。"
    }
  ];

  const beatScores = beats.map((beat, index) => {
    const beatText = `${beat.visual} ${beat.narration} ${beat.purpose}`;
    const score = clipScore(42 + (beat.endSec > beat.startSec ? 10 : 0) + (beat.visual ? 10 : 0) + (beat.narration ? 10 : 0) + (beat.purpose ? 10 : 0) + (containsAny(beatText, [...continuityTerms, ...innovationTerms, ...b2bTerms]) ? 8 : 0));
    return {
      label: `片段 ${index + 1}`,
      timeRange: timeRange(beat.startSec, beat.endSec),
      score,
      verdict: score >= 85 ? "强片段" : score >= 72 ? "可复用" : "需复核",
      evidence: compact(`${beat.visual}｜${beat.purpose}`, 86)
    };
  });
  const score = Math.round((dimensions.reduce((sum, item) => sum + item.score, 0) * 0.8 + beatScores.reduce((sum, item) => sum + item.score, 0) * 0.2) / (dimensions.length * 0.8 + Math.max(beatScores.length, 1) * 0.2));

  return {
    score,
    level: scoreClass(score),
    verdict: score >= 85 ? "具备内容策略样本基础" : score >= 72 ? "可进入策略复盘，建议先局部打磨" : "暂不建议直接复用为策略样本",
    dimensions,
    beatScores,
    revisionActions: Array.from(new Set(dimensions.map((item) => item.revisionAction)))
  };
}
