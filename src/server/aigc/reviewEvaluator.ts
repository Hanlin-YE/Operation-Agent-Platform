import type {
  AigcAdapterJob,
  AigcCreationRequest,
  AigcCreationResponse,
  AigcExecutionSpec,
  AigcReviewDimension,
  AigcReviewReport,
  AigcReviewStageSignal,
  AigcShotSpec
} from "@/server/aigc/types";

const videoTypeLabels: Record<AigcCreationRequest["videoType"], string> = {
  product_ad: "卖点广告短片",
  product_showcase: "产品展示视频",
  brand_intro: "品牌介绍视频",
  xiaohongshu: "小红书口播/种草"
};

const continuityTerms = ["引入", "延续", "回到", "铺垫", "叠化", "接续", "尾帧", "同机位", "自然", "收束"];
const innovationTerms = ["思想穿越", "概念", "机制", "可视化", "视觉锚点", "抽象", "分解", "反差", "记忆点", "钩子"];
const actionTerms = ["咨询", "行动", "引导", "CTA", "草稿", "审核", "下一步", "测试", "保存"];

type ReviewShot = Pick<AigcShotSpec, "shotId" | "prompt" | "transition" | "durationSec" | "requiredAssets" | "goal" | "visualFocus"> & {
  audio?: string;
  referencePolicy?: string;
};

function compact(value: string, max = 96) {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > max ? `${normalized.slice(0, max)}...` : normalized;
}

function clipScore(value: number) {
  return Math.max(30, Math.min(98, Math.round(value)));
}

function containsAny(text: string, terms: string[]) {
  return terms.some((term) => text.includes(term));
}

function uniqueTokens(value: string) {
  return Array.from(new Set(
    value
      .replace(/[，。、“”‘’：；！？,.!?:;()（）/\\|·]/g, " ")
      .split(/\s+/)
      .map((item) => item.trim())
      .filter((item) => item.length >= 2 && !["一个", "可以", "进行", "突出", "生成", "视频", "内容"].includes(item))
  )).slice(0, 24);
}

function tokenHits(source: string, target: string) {
  const tokens = uniqueTokens(source);
  const hits = tokens.filter((token) => target.includes(token));
  return { tokens, hits };
}

function firstFilled(values: Array<string | undefined>, fallback: string) {
  return values.find((value) => value?.trim())?.trim() || fallback;
}

function shotFromExecution(task: AigcExecutionSpec): ReviewShot {
  return {
    shotId: task.shotId,
    goal: task.shotId,
    visualFocus: String(task.payload.prompt || ""),
    prompt: String(task.payload.prompt || ""),
    transition: String(task.payload.tailFrameRequirement || ""),
    durationSec: Number(task.payload.durationSec || 0),
    requiredAssets: Array.isArray(task.payload.requiredAssets) ? task.payload.requiredAssets.map(String) : []
  };
}

function collectShots(job: AigcAdapterJob) {
  const snapshotShots = job.planSnapshot?.shots || [];
  if (snapshotShots.length) return snapshotShots as ReviewShot[];
  return job.execution.map(shotFromExecution);
}

function collectProduction(plan?: AigcCreationResponse) {
  return plan?.skillOrchestration.production || [];
}

function scoreStageSignals(job: AigcAdapterJob, shots: ReturnType<typeof collectShots>, fullText: string): AigcReviewStageSignal[] {
  const production = collectProduction(job.planSnapshot);
  const productionText = production.map((item) => `${item.title}\n${item.copy}\n${item.nextAction}`).join("\n");
  const assets = job.planSnapshot?.assets || [];
  const assetText = assets.map((asset) => `${asset.name} ${asset.promptHint} ${asset.approvalGate}`).join("\n");

  const textEvidence = firstFilled([
    production.find((item) => item.id === "xhs_video_script")?.copy,
    production[0]?.copy,
    shots[0]?.prompt,
    job.request.requirement
  ], job.request.requirement);
  const imageEvidence = firstFilled([
    assets.find((asset) => asset.type === "style")?.promptHint,
    assets.find((asset) => asset.type === "product")?.promptHint,
    shots.find((shot) => shot.requiredAssets.length)?.prompt
  ], job.request.requirement);
  const videoEvidence = firstFilled([
    shots.find((shot) => shot.transition)?.transition,
    shots[0]?.prompt
  ], job.request.requirement);

  const textCoverage = tokenHits(job.request.requirement, `${productionText} ${fullText}`);
  const hasTitle = production.some((item) => item.title.trim().length > 0);
  const hasAction = containsAny(productionText, actionTerms);
  const textScore = clipScore(48 + textCoverage.hits.length * 5 + (hasTitle ? 8 : 0) + (hasAction ? 8 : 0));

  const imageAssetTypes = new Set(assets.map((asset) => asset.type));
  const imageScore = clipScore(48 + imageAssetTypes.size * 8 + (assetText.includes(job.request.styleTone) ? 8 : 0) + (assetText.includes(compact(job.request.requirement, 24).replace("...", "")) ? 6 : 0));

  const videoScore = clipScore(46 + shots.length * 5 + shots.filter((shot) => shot.durationSec > 0).length * 3 + shots.filter((shot) => shot.transition).length * 4);

  return [
    {
      stage: "text",
      label: "文本产物",
      score: textScore,
      evidence: compact(textEvidence),
      feedback: textCoverage.hits.length >= 3 ? "标题、口播或平台文案已经回应用户需求，可继续做平台语气细化。" : `文本产物对“${compact(job.request.requirement, 42)}”回应不足，需要把核心对象和目标人群写进开场。`
    },
    {
      stage: "image",
      label: "图片资产",
      score: imageScore,
      evidence: compact(imageEvidence),
      feedback: assets.length ? "风格、产品、场景或人物资产能支撑后续画面生产，下一步重点检查一致性。" : "尚未保存资产提示，图片阶段无法证明脚本里的画面可被稳定生产。"
    },
    {
      stage: "video",
      label: "视频分镜",
      score: videoScore,
      evidence: compact(videoEvidence),
      feedback: shots.length && shots.every((shot) => shot.transition) ? "分镜、时长和转场约束较完整，具备进入视频生产的执行基础。" : "分镜转场或尾帧约束不足，视频生成时容易出现片段割裂。"
    }
  ];
}

export function buildAigcReview(job: AigcAdapterJob): AigcReviewReport {
  const shots = collectShots(job);
  const production = collectProduction(job.planSnapshot);
  const assetText = (job.planSnapshot?.assets || []).map((asset) => `${asset.name} ${asset.promptHint} ${asset.approvalGate}`).join("\n");
  const productionText = production.map((item) => `${item.title}\n${item.format}\n${item.copy}\n${item.nextAction}`).join("\n");
  const shotText = shots.map((shot) => `${shot.goal} ${shot.visualFocus} ${shot.prompt} ${shot.transition} ${shot.audio || ""} ${shot.referencePolicy || ""}`).join("\n");
  const fullText = `${shotText}\n${assetText}\n${productionText}`;
  const requirementMatch = tokenHits(job.request.requirement, fullText);
  const styleMatched = job.request.styleTone ? fullText.includes(job.request.styleTone) || tokenHits(job.request.styleTone, fullText).hits.length > 0 : false;

  const continuityEvidence = firstFilled([
    shots.find((shot) => containsAny(`${shot.transition} ${shot.prompt}`, continuityTerms))?.transition,
    shots.find((shot) => shot.transition)?.transition,
    shots[0]?.prompt
  ], job.request.requirement);
  const innovationEvidence = firstFilled([
    shots.find((shot) => containsAny(shot.prompt, innovationTerms))?.prompt,
    production.find((item) => containsAny(`${item.title} ${item.copy}`, innovationTerms))?.copy,
    shots[0]?.prompt
  ], job.request.requirement);
  const storyboardEvidence = firstFilled([
    shots.find((shot) => shot.requiredAssets.length >= 2)?.prompt,
    shots[0]?.prompt
  ], job.request.requirement);
  const adaptationEvidence = job.request.requirement;

  const continuityScore = clipScore(
    40 +
      shots.length * 4 +
      shots.filter((shot) => shot.transition).length * 5 +
      shots.filter((shot) => containsAny(`${shot.transition} ${shot.prompt}`, continuityTerms)).length * 4 +
      (fullText.includes("回到") ? 5 : 0)
  );
  const innovationScore = clipScore(
    42 +
      shots.filter((shot) => containsAny(shot.prompt, innovationTerms)).length * 8 +
      (containsAny(productionText, innovationTerms) ? 8 : 0) +
      (styleMatched ? 5 : 0)
  );
  const storyboardScore = clipScore(
    38 +
      shots.length * 4 +
      shots.filter((shot) => shot.durationSec > 0).length * 3 +
      shots.filter((shot) => shot.requiredAssets.length >= 2).length * 5 +
      shots.filter((shot) => shot.referencePolicy).length * 2
  );
  const adaptationScore = clipScore(
    36 +
      requirementMatch.hits.length * 5 +
      (fullText.includes(videoTypeLabels[job.request.videoType]) || fullText.includes(job.request.aspectRatio) ? 5 : 0) +
      (job.request.videoType === "xiaohongshu" && fullText.includes("小红书") ? 6 : 0) +
      (styleMatched ? 5 : 0)
  );

  const dimensions: AigcReviewDimension[] = [
    {
      id: "continuity",
      label: "故事连续性",
      score: continuityScore,
      verdict: continuityScore >= 82 ? "连续性强" : continuityScore >= 68 ? "基本连贯" : "承接不足",
      evidence: compact(continuityEvidence),
      feedback: continuityScore >= 82 ? "脚本能从开场问题、解释、可视化再回到结论，叙事链条完整。" : `围绕“${compact(job.request.requirement, 42)}”的前后镜头承接还不够，需要补清每段如何进入下一段。`,
      revisionAction: continuityScore >= 82 ? "保留首尾呼应，只微调节奏和字幕停留。" : "为每个镜头补一句上一镜到下一镜的承接动作或声音线索。"
    },
    {
      id: "innovation",
      label: "创新性",
      score: innovationScore,
      verdict: innovationScore >= 82 ? "有可记忆表达" : innovationScore >= 68 ? "表达有亮点" : "爆点偏常规",
      evidence: compact(innovationEvidence),
      feedback: innovationScore >= 82 ? "内容已经把需求转成视觉钩子或概念化表达，具备被记住的基础。" : `需要把“${compact(job.request.requirement, 36)}”里的核心矛盾转成更直接的视觉钩子。`,
      revisionAction: "在前三秒加入一个反差问题、可视化比喻或结果前后对比。"
    },
    {
      id: "storyboard",
      label: "分镜专业性",
      score: storyboardScore,
      verdict: storyboardScore >= 82 ? "分镜可执行" : storyboardScore >= 68 ? "分镜基本可用" : "镜头约束不足",
      evidence: compact(storyboardEvidence),
      feedback: storyboardScore >= 82 ? "镜头时长、资产引用和参考策略较完整，能支撑首帧与视频生产。" : "分镜中的资产、时长、尾帧或参考策略缺失，会增加图片和视频生成返工。",
      revisionAction: "逐镜补齐时长、主体动作、资产引用、尾帧状态和字幕空间。"
    },
    {
      id: "adaptation",
      label: "内容适配度",
      score: adaptationScore,
      verdict: adaptationScore >= 82 ? "输入匹配明确" : adaptationScore >= 68 ? "部分回应输入" : "输入回应不足",
      evidence: compact(adaptationEvidence),
      feedback: adaptationScore >= 82 ? `产物已经回应“${compact(job.request.requirement, 42)}”，平台、时长和画幅约束也有体现。` : `当前产物没有充分回应“${compact(job.request.requirement, 42)}”，需要把缺失的对象、场景或目标人群落进脚本。`,
      revisionAction: `把已匹配关键词“${requirementMatch.hits.slice(0, 5).join("、") || "暂无"}”保留，并补齐未体现的用户输入。`
    }
  ];

  const stageSignals = scoreStageSignals(job, shots, fullText);
  const score = Math.round((dimensions.reduce((sum, item) => sum + item.score, 0) * 0.75 + stageSignals.reduce((sum, item) => sum + item.score, 0) * 0.25) / (dimensions.length * 0.75 + stageSignals.length * 0.25));
  const revisionActions = Array.from(new Set(dimensions.map((item) => item.revisionAction)));

  return {
    jobId: job.jobId,
    projectTitle: job.projectTitle,
    updatedAt: job.updatedAt,
    score,
    level: score >= 85 ? "high" : score >= 72 ? "medium" : "low",
    verdict: score >= 85 ? "具备爆款文案候选基础" : score >= 72 ? "有传播潜力，但需要针对输入再打磨" : "暂不建议进入爆款投放验证",
    planCaptured: Boolean(job.planSnapshot),
    matchedInputs: [
      job.request.requirement,
      `${videoTypeLabels[job.request.videoType]} / ${job.request.durationSec} 秒 / ${job.request.aspectRatio} / ${job.request.styleTone}`,
      compact(firstFilled([shots[0]?.prompt, production[0]?.copy], job.request.requirement))
    ],
    dimensions,
    stageSignals,
    revisionActions
  };
}
