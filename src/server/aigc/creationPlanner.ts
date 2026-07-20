import {
  AigcAdapterPlan,
  AigcAssetItem,
  AigcCreationRequest,
  AigcCreationResponse,
  AigcExecutionSpec,
  AigcLayerSummary,
  AigcShotSpec,
  AigcVideoType
} from "@/server/aigc/types";
import { buildSkillOrchestration } from "@/server/aigc/skillOrchestration";

const videoTypeLabels: Record<AigcVideoType, string> = {
  product_ad: "卖点广告短片",
  product_showcase: "产品展示视频",
  brand_intro: "品牌介绍视频",
  xiaohongshu: "小红书口播/种草视频"
};

function normalizeRequirement(input: string) {
  return input.replace(/\s+/g, " ").trim();
}

function inferAudience(videoType: AigcVideoType) {
  switch (videoType) {
    case "product_ad":
      return "潜在客户与投放流量受众";
    case "product_showcase":
      return "电商详情页与销售演示受众";
    case "brand_intro":
      return "品牌合作方与企业客户";
    case "xiaohongshu":
      return "社媒平台上的泛兴趣用户";
  }
}

function inferDeliverable(request: AigcCreationRequest) {
  return `${request.durationSec} 秒 ${request.aspectRatio} ${videoTypeLabels[request.videoType]}`;
}

function buildLayers(): AigcLayerSummary[] {
  return [
    { id: "brief", name: "需求理解层", purpose: "把自然语言收敛成创作目标、受众和交付约束", output: "CreativeBrief" },
    { id: "asset", name: "资产锁定层", purpose: "先锁风格、人物、场景和产品资产，阻止直接批量生成", output: "AssetPack" },
    { id: "prompt", name: "提示词编译层", purpose: "把分镜和资产引用转成镜头级提示词", output: "ShotPromptPack" },
    { id: "execution", name: "执行封装层", purpose: "生成平台无关的执行规格，再映射到外部平台", output: "ExecutionSpec[]" },
    { id: "adapter", name: "平台适配层", purpose: "负责提交、轮询、下载、重试和失败兜底", output: "ProviderJob" }
  ];
}

function buildAssets(request: AigcCreationRequest): AigcAssetItem[] {
  const requirement = normalizeRequirement(request.requirement);
  return [
    {
      assetId: "STYLE00",
      type: "style",
      name: `${request.styleTone} 风格板`,
      approvalGate: "确认平台、提示词语言和主视觉基调后才能放行",
      promptHint: `统一 ${request.styleTone} 质感、构图语言、灯光配方和色板，不生成具体剧情。`
    },
    {
      assetId: "P01",
      type: "product",
      name: "主产品资产",
      approvalGate: "确认卖点呈现方式和镜头优先级",
      promptHint: `围绕需求“${requirement}”锁定产品外观、材质、主角度和禁止漂移项。`
    },
    {
      assetId: "S01",
      type: "scene",
      name: "主场景资产",
      approvalGate: "确认拍摄环境、背景复杂度和信息密度",
      promptHint: "输出前视、侧视、三分之四视角和布局视图，供分镜复用。"
    },
    {
      assetId: "C01",
      type: "character",
      name: request.videoType === "xiaohongshu" ? "口播人物资产" : "辅助人物资产",
      approvalGate: "仅在人物出镜时启用；未审批不得写进逐镜提示词",
      promptHint: "固定年龄、服装、表情和动作区间，避免每个镜头重写人物设定。"
    }
  ];
}

function buildShots(request: AigcCreationRequest): AigcShotSpec[] {
  const requirement = normalizeRequirement(request.requirement);
  const perShot = Math.max(3, Math.round(request.durationSec / 3));
  return [
    {
      shotId: "SHOT_01",
      goal: "建立主视觉与信息主题",
      durationSec: perShot,
      visualFocus: "第一眼看懂主体和风格",
      requiredAssets: ["STYLE00", "P01", "S01"],
      prompt: `基于 STYLE00 与 P01，建立 ${request.aspectRatio} 开场画面，突出“${requirement}”的核心主题，镜头干净、信息集中。`
    },
    {
      shotId: "SHOT_02",
      goal: "展开关键卖点或情绪推进",
      durationSec: perShot,
      visualFocus: request.videoType === "xiaohongshu" ? "人物表达与产品关系" : "产品细节与使用动作",
      requiredAssets: request.videoType === "xiaohongshu" ? ["STYLE00", "P01", "C01"] : ["STYLE00", "P01"],
      prompt: "保持 STYLE00 风格一致，展示主要卖点、动作或转场，禁止形态漂移和无关字幕。"
    },
    {
      shotId: "SHOT_03",
      goal: "收束利益点并保留后期空间",
      durationSec: Math.max(2, request.durationSec - perShot * 2),
      visualFocus: "收尾信息、品牌识别和可加字区域",
      requiredAssets: ["STYLE00", "P01", "S01"],
      prompt: "收尾镜头保留清洁画面和后期文案区域，不在生成阶段写死长文本。"
    }
  ];
}

function buildAdapter(platform: AigcCreationRequest["platform"]): AigcAdapterPlan {
  if (platform === "tapnow") {
    return {
      platform,
      submissionMode: "web_adapter",
      standardModelUrl: undefined,
      imageModel: "待确认",
      videoModel: "待确认",
      modelNote: undefined,
      capabilityRoute: ["asset upload", "prompt fill", "generate submit", "task polling", "media download"],
      operatorChecklist: ["维护登录态和账号配额", "固定页面选择器", "保存平台 task_id 和输出链接"],
      fallbackPolicy: "页面结构变更或风控触发时，退回人工接管模式。"
    };
  }

  if (platform === "runninghub") {
    return {
      platform,
      submissionMode: "web_adapter",
      standardModelUrl: "https://www.runninghub.cn/call-api/search-api/standard-model?search=",
      imageModel: "即梦图片 4.6 文生图",
      videoModel: "Seedance v1.5 Pro 图生视频",
      modelNote: "RunningHub 标准模型页当前可直接确认到即梦图片 4.6；视频侧采用同属字节系的视频模型 Seedance 作为即梦链路落地。",
      capabilityRoute: ["standard model lookup", "workflow param mapping", "node execution trigger", "run status polling", "artifact collect"],
      operatorChecklist: [
        "图片首帧走 即梦图片 4.6 文生图，先产出风格锁定帧",
        "视频段默认走 Seedance 图生视频，把已审批首帧转成动态图",
        "记录 runninghub model slug、run_id、失败节点和重试次数"
      ],
      fallbackPolicy: "如果镜头不适合首帧驱动，再切换为 seedance2.0/文生视频，但保持 RunningHub 作为唯一执行平台。"
    };
  }

  return {
    platform,
    submissionMode: "manual_handoff",
    standardModelUrl: undefined,
    imageModel: "待确认",
    videoModel: "待确认",
    modelNote: undefined,
    capabilityRoute: ["prompt pack export", "operator review", "manual submission", "artifact import back"],
    operatorChecklist: ["优先确定平台 API 是否公开", "没有稳定接口前不要承诺全自动", "把提交记录写回内部任务表"],
    fallbackPolicy: "平台能力不明时，保留人工执行和结果回填。"
  };
}

function buildExecution(request: AigcCreationRequest, shots: AigcShotSpec[]): AigcExecutionSpec[] {
  return shots.map((shot, index) => ({
    shotId: shot.shotId,
    mode: index === 0 ? "text_to_image" : "image_to_video",
    adapterAction: index === 0 ? "generate first frame" : "animate approved frame",
    payload: {
      prompt: shot.prompt,
      durationSec: shot.durationSec,
      aspectRatio: request.aspectRatio,
      promptLanguage: request.promptLanguage,
      styleTone: request.styleTone,
      requiredAssets: shot.requiredAssets
    }
  }));
}

export function buildAigcCreationPlan(request: AigcCreationRequest): AigcCreationResponse {
  const normalized = normalizeRequirement(request.requirement);
  const assets = buildAssets(request);
  const shots = buildShots(request);
  const execution = buildExecution(request, shots);
  const skillOrchestration = buildSkillOrchestration({ requirement: normalized });

  return {
    projectTitle: `${videoTypeLabels[request.videoType]} · ${request.platform.toUpperCase()} 执行封装`,
    summary: `已将用户需求收敛为可执行层级：先锁资产，再编译分镜，最后经平台适配层提交到 ${request.platform}。`,
    layers: buildLayers(),
    brief: {
      audience: inferAudience(request.videoType),
      deliverable: inferDeliverable(request),
      successSignal: `用户能够用一句“${normalized}”发起任务，系统返回可审核、可提交、可追踪的生成包。`
    },
    assets,
    shots,
    execution,
    adapter: buildAdapter(request.platform),
    skillOrchestration
  };
}
