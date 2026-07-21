import {
  AigcAdapterPlan,
  AigcAssetItem,
  AigcCreationRequest,
  AigcCreationResponse,
  AigcContinuityProtocol,
  AigcExecutionSpec,
  AigcLayerSummary,
  AigcProductionStage,
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
      promptHint: "输出无人物的 16:9 场景大全景；只在反打、新场景或新道具时另建必要分镜参考。"
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

function buildWorkflow(): AigcProductionStage[] {
  return [
    { id: "script", name: "剧本核审", deliverable: "单集五段式科普剧本", approvalGate: "人工逐轮校调：科学表述、转场铺垫、节奏与收束", rule: "未批准不得进入资产与分镜。" },
    { id: "assets", name: "资产与分镜核审", deliverable: "STYLE00、角色/场景资产表与分镜描述", approvalGate: "确认资产必要性、比例、资产引用和镜头合理性", rule: "角色图 3:4；场景图 16:9；低清参考先高清。" },
    { id: "images", name: "资产生图", deliverable: "已审核资产图与必要关键分镜图", approvalGate: "检查人物、场景、道具和画质一致性", rule: "场景一般仅需一张无人物大全景。" },
    { id: "serial-video", name: "串行视频生成", deliverable: "片段分镜提示词与视频提示词", approvalGate: "逐段确认尾帧、参考包和参数最小化", rule: "后一段只在上一段核审后生成，禁止并行。" },
    { id: "edit", name: "剪辑与调音", deliverable: "高清母版、字幕前成片", approvalGate: "检查转场、调色、响度、J/L 剪辑与节奏", rule: "大转场叠化；先高清再加字幕。" },
    { id: "delivery", name: "成片核审与归档", deliverable: "最终成片与 AI 影视项目记录", approvalGate: "成员确认无穿帮、无音频跳跃、科普准确", rule: "记录资产、版本、审批与交付链接。" }
  ];
}

function buildContinuity(): AigcContinuityProtocol {
  return {
    narrativeTemplate: "现实情景提问 → Taotao 讲解 → 画面思想穿越 → 两人旁观讨论 → 回到现实感慨；重科普，轻剧情。",
    referenceRules: [
      "同场景同机位：给上段同机位截图与上段音频，避免重复上传人物、场景、音色参考。",
      "反打、全新场景或新道具：给一张必要关键分镜图/参考图，且不得与场景图或尾帧冲突。",
      "强调尾帧应达成的状态，不要求机械接续尾帧；低清图先高清后再作连续参考。",
      "优先单张关键分镜或人物+场景构图；避免 25 宫格、360 全景和易模糊的参考视频。"
    ],
    editAndQc: [
      "BGM 至少覆盖一半时长；同情绪连续段沿用同一环境音/BGM描述，边界用淡入淡出和 J/L 剪辑。",
      "场景切换须有画面或声音铺垫；大转场使用叠化，思想穿越/回忆可加褪色与暗角。",
      "用曲线变速调节节奏；统一响度；校正偏色和过饱和；减少手部、道具、空间穿帮。"
    ]
  };
}

function buildShots(request: AigcCreationRequest): AigcShotSpec[] {
  const requirement = normalizeRequirement(request.requirement);
  const setup = Math.max(3, Math.round(request.durationSec * 0.15));
  const explain = Math.max(4, Math.round(request.durationSec * 0.25));
  const travel = Math.max(4, Math.round(request.durationSec * 0.3));
  const observe = Math.max(3, Math.round(request.durationSec * 0.15));
  const close = Math.max(2, request.durationSec - setup - explain - travel - observe);
  return [
    {
      shotId: "SHOT_01",
      goal: "现实场景抛出问题",
      durationSec: setup,
      visualFocus: "真实困惑、可见问题与后续穿越的视觉伏笔",
      requiredAssets: ["STYLE00", "P01", "S01"],
      prompt: `基于 STYLE00、P01、S01，以真实情景提出“${requirement}”相关问题。快速推近关键细节，结尾用光线、声音或视线引出 Taotao 的解释；台词写入画面描述，画面干净。`,
      transition: "问题细节停留半拍，利用视线/提示音引入解释，不突切。",
      audio: "连续环境音；轻快、克制的科普 BGM 从开场进入；必要的提示音。",
      referencePolicy: "首段使用已审批资产；不上传无关的重复参考。"
    },
    {
      shotId: "SHOT_02",
      goal: "Taotao 拆解问题",
      durationSec: explain,
      visualFocus: "人物讲解、关键机制与注意力焦点切换",
      requiredAssets: ["STYLE00", "P01", "S01", "C01"],
      prompt: "Taotao 在现实场景用简洁动作讲解核心原理，镜头在中景、细节特写间切换；保留人物形象、服装、音色一致，结尾把手势或画面元素导向思想穿越。",
      transition: "手势/物体细节匹配切入概念化画面，保留 BGM 和一句话尾音做 J 剪辑。",
      audio: "沿用 SHOT_01 的环境音与同一 BGM；动作同步的轻微拟音。",
      referencePolicy: "连续同机位时给 SHOT_01 同机位截图+上段音频；反打才给一张必要分镜图。"
    },
    {
      shotId: "SHOT_03",
      goal: "思想穿越可视化科普",
      durationSec: travel,
      visualFocus: "抽象机制被看见，信息密度最高但镜头动作单一明确",
      requiredAssets: ["STYLE00", "P01"],
      prompt: "由 SHOT_02 的视觉锚点进入思想穿越，用具象化但可理解的画面解释“${requirement}”的关键机制。快节奏分解一个核心动作，不添加长文本；尾帧保留回到现实的方向性。",
      transition: "延续前一镜的手势/光线；思想画面褪色暗角后叠化回现实。",
      audio: "同一 BGM 持续并略增强；抽象化音效与讲解节奏同步，转场前淡出。",
      referencePolicy: "全新概念场景或道具仅上传一张关键分镜图；不得与尾帧和场景图冲突。"
    },
    {
      shotId: "SHOT_04",
      goal: "两人成为旁观者讨论",
      durationSec: observe,
      visualFocus: "人物对概念画面的观察与一句关键结论",
      requiredAssets: ["STYLE00", "C01"],
      prompt: "两人站在概念画面一侧作为旁观者，短促讨论刚才的机制；使用有动机的正反打或侧移，人物不抢占解释主体，结尾以回望现实的动作收束。",
      transition: "以人物回望/走出画框为回归现实的铺垫。",
      audio: "BGM 延续；语音自然接续；保留极轻的概念环境音后渐弱。",
      referencePolicy: "正反打必须给必要关键分镜图；若上段音频已足够，不重复上传音色参考。"
    },
    {
      shotId: "SHOT_05",
      goal: "回到现实并给出可执行感慨",
      durationSec: close,
      visualFocus: "现实问题被重新理解，干净收尾与后期字幕空间",
      requiredAssets: ["STYLE00", "P01", "S01", "C01"],
      prompt: "回到 SHOT_01 的现实场景和可识别机位，用一句简洁感慨收束科普结论；镜头拉远或稳定停留，留出后期字幕区域，避免生成长文本。",
      transition: "从 SHOT_04 的动作/音效自然落回同一现实环境，禁止突跳。",
      audio: "回归 SHOT_01 同一环境音；BGM 在片尾自然淡出；结尾可有一个轻提示音。",
      referencePolicy: "给 SHOT_01 同机位截图或同场景关键帧，确保回归现实的场景和人物不漂移。"
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
    adapterAction: index === 0 ? "generate approved opening frame" : `serially animate after ${shots[index - 1].shotId} approval`,
    payload: {
      prompt: shot.prompt,
      durationSec: shot.durationSec,
      aspectRatio: request.aspectRatio,
      promptLanguage: request.promptLanguage,
      styleTone: request.styleTone,
      requiredAssets: shot.requiredAssets,
      dependsOnShotId: index === 0 ? "asset approval" : shots[index - 1].shotId,
      referencePolicy: shot.referencePolicy,
      tailFrameRequirement: shot.transition
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
    workflow: buildWorkflow(),
    continuity: buildContinuity(),
    execution,
    adapter: buildAdapter(request.platform),
    skillOrchestration
  };
}
