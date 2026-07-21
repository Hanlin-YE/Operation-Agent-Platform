import { ContentStrategyImage, ContentStrategyMetrics, ContentStrategyPack, ContentStrategyPlatform } from "@/server/data/types";
import { generateJsonCompletion } from "@/server/llm/provider";
import { createContentStrategy, updateContentStrategy } from "@/server/repositories/contentStrategies";

export type StrategyInput = { platform: ContentStrategyPlatform; title: string; content: string; sourceUrl?: string; metrics: ContentStrategyMetrics; images: ContentStrategyImage[]; imageData?: { mimeType: string; dataUrl: string }[] };
const maxContentLength = 12000;

function validate(input: StrategyInput) {
  if (!input.title.trim() || !input.content.trim()) return "请提供对标样本的标题和正文/字幕。";
  if (input.content.length > maxContentLength) return `正文/字幕不能超过 ${maxContentLength} 字符。`;
  if (input.images.length > 3) return "最多上传 3 张图片样本。";
  if (input.sourceUrl && !/^https?:\/\//.test(input.sourceUrl)) return "对标链接需以 http:// 或 https:// 开头。";
  return null;
}

const system = `你是工业 B2B 内容策略分析师。只分析用户提供的文字、指标和图片；将观察、推断与缺失数据严格区分。禁止虚构表现、客户证言、行业事实，禁止煽动式争议或欺骗性钩子。输出严格 JSON：confidence(high|medium|low), missingData(string[]), evidence(string[]), hook(string), structure(string[]), rhythm(string), audience(string), reusableMethods(string[]), b2bRisks(string[]), evidenceRequirements(string[]), recommendations({wechat:string,xhsImage:string,xhsVideo:string})。`;

function isAnalysis(value: unknown): value is NonNullable<ContentStrategyPack["analysis"]> {
  if (!value || typeof value !== "object") return false;
  const data = value as Record<string, unknown>;
  const strings = ["hook", "rhythm", "audience"];
  const lists = ["missingData", "evidence", "structure", "reusableMethods", "b2bRisks", "evidenceRequirements"];
  const recommendations = data.recommendations as Record<string, unknown> | undefined;
  return ["high", "medium", "low"].includes(String(data.confidence)) && strings.every((key) => typeof data[key] === "string") && lists.every((key) => Array.isArray(data[key]) && data[key].every((entry) => typeof entry === "string")) && !!recommendations && ["wechat", "xhsImage", "xhsVideo"].every((key) => typeof recommendations[key] === "string");
}

export async function analyzeContentStrategy(input: StrategyInput): Promise<ContentStrategyPack> {
  const invalid = validate(input); if (invalid) throw new Error(invalid);
  const base = { version: 1, sample: { platform: input.platform, title: input.title.trim(), content: input.content.trim(), sourceUrl: input.sourceUrl?.trim() || undefined, metrics: input.metrics, images: input.images } };
  const result = await generateJsonCompletion<NonNullable<ContentStrategyPack["analysis"]>>({
    system,
    user: `平台：${input.platform}\n标题：${input.title}\n正文/字幕：${input.content}\n人工指标：${JSON.stringify(input.metrics)}\n对标链接：${input.sourceUrl || "未提供"}\n图片数：${input.images.length}`,
    images: input.imageData
  });
  if (result.status === "model_not_configured") return createContentStrategy({ ...base, status: "model_not_configured" });
  if (result.status === "error") return createContentStrategy({ ...base, status: "error", error: result.message });
  const analysis = result.data;
  if (!isAnalysis(analysis)) return createContentStrategy({ ...base, status: "error", error: "模型输出未通过策略包结构校验。" });
  return createContentStrategy({ ...base, status: "needs_review", analysis });
}

export async function requestContentStrategyRework(parent: ContentStrategyPack, input: { operator: string; stage: "strategy_review" | "production_confirmation" | "production_draft"; reason: string }) {
  const reason = input.reason.trim();
  if (!reason) throw new Error("返工意见不能为空。");
  const rework = { operator: input.operator || "当前运营人员", stage: input.stage, reason, requestedAt: new Date().toISOString(), targetVersion: parent.version + 1 };
  await updateContentStrategy(parent.id, { status: "superseded", productionConfirmation: undefined, productionDraft: parent.productionDraft ? { ...parent.productionDraft, invalidatedAt: new Date().toISOString() } : undefined, rework });
  const base = { version: parent.version + 1, parentId: parent.id, sample: parent.sample, rework };
  const draft = await createContentStrategy({ ...base, status: "rework_processing" });
  return retryContentStrategyRework(draft, parent.analysis);
}

export async function retryContentStrategyRework(item: ContentStrategyPack, previousAnalysis?: ContentStrategyPack["analysis"]) {
  if (!item.rework) throw new Error("缺少返修需求。");
  await updateContentStrategy(item.id, { status: "rework_processing", error: undefined });
  const result = await generateJsonCompletion<NonNullable<ContentStrategyPack["analysis"]>>({ system, user: `这是第 ${item.version} 版返修。原始样本：${JSON.stringify(item.sample)}\n上一版策略：${JSON.stringify(previousAnalysis || item.analysis)}\n用户返修需求（最高优先级）：${item.rework.reason}\n必须遵守证据真实性规则，并返回完整策略 JSON。` });
  if (result.status === "model_not_configured") return (await updateContentStrategy(item.id, { status: "rework_pending", error: undefined }))!;
  if (result.status === "error" || !isAnalysis(result.data)) return (await updateContentStrategy(item.id, { status: "rework_failed", error: result.status === "error" ? result.message : "返修输出未通过策略包结构校验。" }))!;
  return (await updateContentStrategy(item.id, { status: "needs_review", analysis: result.data, error: undefined }))!;
}
