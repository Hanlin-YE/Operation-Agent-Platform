import type { AigcSkillOrchestration } from "@/server/aigc/types";

export type ImageBackend = AigcSkillOrchestration["image"];
export type SkillOrchestration = AigcSkillOrchestration;

/**
 * Native image generation cannot be inferred from an arbitrary model key: a
 * deployment must deliberately declare that the free runtime capability exists.
 * The safe default is the project's already-governed RunningHub path.
 */
export function resolveImageBackend(environment: Record<string, string | undefined> = process.env): ImageBackend {
  if (environment.NATIVE_IMAGEGEN_AVAILABLE === "true") {
    return {
      provider: "native_imagegen",
      label: "原生 imagegen（免费运行时能力）",
      free: true,
      rationale: "部署已明确声明原生图片能力可用，因此优先使用免费原生后端。"
    };
  }

  return {
    provider: "runninghub",
    label: "RunningHub · 即梦图片 4.6",
    free: false,
    rationale: "未明确启用免费原生 imagegen；按策略强制使用 RunningHub，禁止回退到其他图片供应商。"
  };
}

export function buildSkillOrchestration(input: { imageBackend?: ImageBackend; requirement?: string } = {}): SkillOrchestration {
  const image = input.imageBackend || resolveImageBackend();
  const requirement = input.requirement?.replace(/\s+/g, " ").trim() || "当前创作主题";
  return {
    image,
    skills: [
      {
        id: "content-creation-publisher",
        name: "内容创作与发布",
        stage: "content",
        mode: "project_adapter",
        safetyNote: "仅生成结构化内容草稿、证据引用和渠道素材，不直接发布。"
      },
      {
        id: "baoyu-xhs-images",
        name: "小红书图文卡",
        stage: "image_cards",
        mode: "project_adapter",
        safetyNote: "先保存逐卡提示词和首图锚点；图片后端仅允许原生 imagegen 或 RunningHub。"
      },
      {
        id: "video-creation-suite",
        name: "视频创作套件",
        stage: "video_plan",
        mode: "project_adapter",
        safetyNote: "复用分镜、配音和合成规范；图片/视频生成统一交由受控平台适配器。"
      },
      {
        id: "video-creation-collaborator",
        name: "视频协作与质检",
        stage: "video_qc",
        mode: "template_only",
        safetyNote: "复用角色分工、资产规格与 QC 标准，不执行其占位生成脚本。"
      },
      {
        id: "baoyu-post-to-wechat",
        name: "公众号草稿发布",
        stage: "publish",
        mode: "project_adapter",
        safetyNote: "仅允许写入公众号草稿箱；必须通过人工审批，禁止自动群发。"
      }
    ],
    production: [
      {
        id: "wechat_article",
        platform: "微信公众号",
        title: "稳定性不是口号：工业产品如何在 30 秒内讲清价值",
        format: "标题、摘要、正文与配图建议",
        copy: `【摘要】\n客户真正关心的不是参数堆得多漂亮，而是设备在真实工况下能否稳定运行。围绕“${requirement}”，我们先把场景、风险和可验证项讲清楚。\n\n【正文】\n当产品进入连续运行、负载波动或交付周期紧张的场景，稳定性决定的不只是一次使用体验，更是停机风险和后续维护成本。\n\n与其泛泛强调性能，不如先确认三个问题：设备承担什么动作？峰值负载和连续运行时长是多少？现场需要验证哪些指标？这些答案决定了选型、测试和交付方案。\n\n【结尾】\n如果你正在评估类似工况，欢迎提交使用场景、负载和运行时长；我们会据此整理需要核验的技术项。`,
        nextAction: "人工审核内容与证据表述后，保存为公众号草稿。"
      },
      {
        id: "xhs_image_cards",
        platform: "小红书图文",
        title: "工业设备稳定不稳定，先看这 4 个问题",
        format: "封面与五页知识卡文案",
        copy: `【封面】\n工业设备总出小问题？先别急着换产品。\n\n【第 1 页】\n先说场景：连续运行、频繁启停、负载变化，哪个才是现场的真实难点？\n\n【第 2 页】\n再看风险：短期能跑不等于长期稳定，异常停机、温升和维护频次都要记录。\n\n【第 3 页】\n验证不是看宣传语。把负载、运行时长、安装条件和目标指标列出来，才能判断方案是否适合。\n\n【第 4 页】\n围绕“${requirement}”，先确认要解决的问题，再选择对应的技术路径。\n\n【第 5 页】\n评论区留下你的使用场景和最关心的问题，我们一起把核验清单补全。`,
        nextAction: "人工确认逐页文案与视觉风格后，生成图片卡片草稿。"
      },
      {
        id: "xhs_video_script",
        platform: "小红书短视频",
        title: "别只看参数：30 秒看懂稳定性该怎么验证",
        format: "口播稿、镜头与结尾引导",
        copy: `【0–3 秒】\n口播：工业产品选得对不对，先别只看参数，先看它能不能在你的工况里稳定跑下去。\n画面：设备运行特写，叠加“稳定不等于口号”。\n\n【4–15 秒】\n口播：连续运行多久、负载怎么变化、现场安装条件怎样——这三个问题不清楚，任何性能描述都很难落地。\n画面：依次展示运行时长、负载、安装环境三个信息点。\n\n【16–25 秒】\n口播：围绕“${requirement}”，把要验证的指标列成清单，再决定方案是否值得投入测试。\n画面：技术人员勾选核验清单。\n\n【26–30 秒】\n口播：把你的使用场景发来，我们一起把需要验证的重点列清楚。\n画面：干净产品画面与咨询引导。`,
        nextAction: "人工审核口播、画面和证据边界后，再进入首帧与视频生产。"
      },
      {
        id: "video_asset_pack",
        platform: "视频资产包",
        title: "配音与镜头内容包",
        format: "配音稿、镜头重点与审核项",
        copy: "【配音主线】\n稳定性不能只靠一句卖点证明，要回到真实工况和可核验指标。\n\n【镜头重点】\n第一镜建立产品与场景；第二镜展示连续运行、负载和安装条件；第三镜呈现核验清单与咨询引导。\n\n【审核项】\n不夸大性能；不使用无法证明的数据；产品外观、场景与文字信息保持一致。",
        nextAction: "确认配音、镜头和审核项后，生成对应的视觉资产与视频草稿。"
      }
    ],
    publish: {
      mode: "draft_only",
      requiresHumanApproval: true,
      credentialNames: ["WECHAT_APP_ID", "WECHAT_APP_SECRET"]
    }
  };
}
