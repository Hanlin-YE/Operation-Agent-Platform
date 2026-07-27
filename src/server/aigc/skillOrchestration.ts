import type { AigcSkillOrchestration, AigcTargetPlatform } from "@/server/aigc/types";

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

const defaultTargetPlatforms: AigcTargetPlatform[] = ["wechat_article", "xhs_image_cards", "xhs_video_script", "video_asset_pack"];

function normalizeTargetPlatforms(input?: AigcTargetPlatform[]) {
  const selected = input?.filter((item, index, list) => defaultTargetPlatforms.includes(item) && list.indexOf(item) === index);
  return selected?.length ? selected : defaultTargetPlatforms;
}

function buildProduction(requirement: string, targetPlatforms: AigcTargetPlatform[]): AigcSkillOrchestration["production"] {
  const allProduction: AigcSkillOrchestration["production"] = [
    {
      id: "wechat_article",
      platform: "微信公众号",
      title: "稳定性不是口号：工业产品如何讲清长期价值",
      format: "长文标题、摘要、正文段落与配图建议",
      strategy: "公众号适合承接搜索、转发和私域教育：多给背景、逻辑链、核验清单和证据边界，弱化短平快口号。",
      copy: `【标题】\n稳定性不是口号：一篇讲清“${requirement}”背后的电机结构、选型逻辑和验证方法\n\n【摘要】\n电机不是只看转速、功率和尺寸就能判断好坏的标准件。尤其是空心杯电机、微型无刷电机和高响应执行器场景，客户真正关心的是：转子惯量够不够低，响应是否足够快，温升能否控制住，长时间运行是否稳定，批量交付时性能是否一致。围绕“${requirement}”，这篇文章建议从电机结构、真实工况、风险边界和测试验证四个角度讲清楚，让读者知道为什么这类电机适合精密应用，也知道下一步应该拿哪些数据来判断方案是否可靠。\n\n一、为什么客户不会只因为“参数漂亮”就下判断\n工业采购和技术评审天然谨慎。客户面对一款电机时，通常不会只问“最高转速是多少”或“额定功率是多少”，而会追问这些参数是在什么工况下测得的：负载多大，连续运行多久，环境温度多少，是否带齿轮箱，驱动控制策略是什么，温升曲线是否稳定，噪声和振动是否满足整机要求。\n\n对空心杯电机来说，核心价值往往来自结构本身。无铁芯转子可以降低转动惯量，减少齿槽效应，让电机在启动、停止和变速时更灵敏；紧凑的体积和较高的功率密度，使它适合放进机械手、医疗器械、精密泵、云台、激光雷达和微型执行机构等空间受限的设备中。但这些优势必须放回具体工况中理解：低惯量带来响应速度，高功率密度带来小体积输出能力，而稳定的绕组、轴承、换向或驱动方案，决定它能不能长期可靠运行。\n\n二、从真实工况切入，而不是从单个卖点切入\n如果内容一开头只写“稳定、可靠、高性能”，读者很难判断这些词和自己的设备有什么关系。更有效的写法，是先描绘电机进入整机后的工作状态：它是否需要频繁启停，是否长期连续运转，是否承受负载波动，是否对噪声敏感，安装空间是否受限，是否需要和齿轮箱、编码器、驱动器一起匹配。\n\n围绕“${requirement}”，正文可以这样展开：一台电机能否稳定工作，并不只由额定参数决定，而是由磁路设计、绕组工艺、转子平衡、轴承寿命、散热路径、驱动控制和装配一致性共同决定。比如在机器人灵巧手里，电机要关注低惯量、响应速度和体积；在医疗泵或精密泵里，要关注连续运行、温升、噪声和寿命；在云台或光学设备里，要关注平稳性、振动和控制精度。不同应用场景下，“好电机”的判断标准并不完全相同。\n\n三、把电机的适用边界讲清楚，反而更容易建立信任\n工业客户并不害怕产品有边界，他们害怕供应商不说边界。电机内容应该主动说明哪些条件需要进一步验证，例如：高频启停是否会影响碳刷或轴承寿命，长时间满载是否需要额外散热，电机和齿轮箱组合后效率会如何变化，驱动参数是否会影响噪声、温升和响应，样机测试通过后批量交付如何保证一致性。\n\n这部分不要写成“我们的电机完全没有风险”，而要写成“这类电机应该如何被正确验证”。例如，样机阶段建议同步记录空载电流、负载电流、温升曲线、转速稳定性、噪声、振动和响应时间；连续运行测试中要关注温升是否进入稳定平台，轴承或换向结构是否出现异常磨损；批量阶段则要关注绕组一致性、动平衡、出厂测试口径、包装运输和售后替换机制。把这些问题讲清楚，客户才会觉得供应商真正理解电机应用，而不是只在背参数表。\n\n四、给出可执行的电机核验清单\n一篇面向电机客户的长文，结尾前应该给读者一个可以拿走的技术清单。围绕“${requirement}”，建议正文中加入如下核验框架：\n\n1. 应用场景：设备类型、安装空间、运动方式、运行时长、启停频次、噪声限制和环境温度。\n2. 负载信息：额定负载、峰值负载、负载变化范围、是否有冲击负载、是否存在堵转或过载风险。\n3. 电机指标：额定电压、空载转速、额定转速、额定电流、堵转电流、输出转矩、效率、温升、寿命和噪声。\n4. 组合方案：是否需要齿轮箱、编码器、驱动器、FOC 控制或定制轴伸，整机空间和散热路径是否匹配。\n5. 验证材料：样机测试记录、温升曲线、寿命测试、噪声测试、批次抽检规则、选型计算书和应用案例。\n6. 交付约束：样机周期、批量周期、质量责任、备件策略、异常处理流程和售后响应时间。\n\n这份清单的作用，是把“电机看起来不错”转化为“这台电机是否适合我的设备”。读者可以先按清单整理自己的工况，再和供应商沟通型号、参数和测试方案。对销售团队来说，这也能减少无效沟通，把客户从泛泛咨询推进到可验证的技术交流。\n\n五、下一步：把电机选型推进到样机验证\n文章的结尾不建议写得太空。可以明确告诉读者：如果正在评估类似电机方案，可以把应用场景、负载范围、运行时长、安装空间、目标寿命和噪声要求发来。我们会先判断适合有刷空心杯、无刷空心杯，还是需要电机、齿轮箱与驱动控制的整体方案；再整理需要验证的关键指标，决定是否进入样机测试。\n\n【结尾引导】\n如果你正在推进“${requirement}”相关项目，可以先准备三类信息：设备工况、核心性能指标、交付与验证要求。我们会基于这些信息，把电机选型问题拆成可测试、可复盘、可交付的技术项，避免只凭单个参数做决定，也避免因为缺少工况信息而选错型号。\n\n【配图建议】\n头图建议使用空心杯电机、齿轮箱或测试台的真实近景；正文第一张图展示电机结构和转子特点，第二张图展示温升/负载/寿命核验清单，第三张图展示产品、测试仪器和工程记录同框。整体视觉应当冷静、可信，突出精密电机、应用场景和测试验证。`,
      imagePrompts: [
        "公众号头图：真实工业应用场景，产品位于清晰工作台或设备内部，冷静专业光线，留出标题文字区域，不出现夸张科幻元素。",
        "正文配图：技术核验清单放在桌面旁，产品、测试仪器和工况草图同框，信息可信、画面干净。"
      ],
      nextAction: "人工审核技术证据、禁用绝对化表述后，保存为公众号草稿。"
    },
    {
      id: "xhs_image_cards",
      platform: "小红书图文",
      title: "工业设备稳定不稳定，先看这 4 个问题",
      format: "封面、五页知识卡文案与逐图提示词",
      strategy: "小红书图文优先钩子、分屏知识卡和可收藏清单：文案短、节奏快，每页只解决一个判断点，并同时给图片生成提示词。",
      copy: `【封面】\n工业设备总出小问题？先别急着换产品。\n\n【第 1 页】\n先说场景：连续运行、频繁启停、负载变化，哪个才是现场的真实难点？\n\n【第 2 页】\n再看风险：短期能跑不等于长期稳定，异常停机、温升和维护频次都要记录。\n\n【第 3 页】\n验证不是看宣传语。把负载、运行时长、安装条件和目标指标列出来，才能判断方案是否适合。\n\n【第 4 页】\n围绕“${requirement}”，先确认要解决的问题，再选择对应的技术路径。\n\n【第 5 页】\n评论区留下你的使用场景和最关心的问题，我们一起把核验清单补全。`,
      imagePrompts: [
        "小红书封面，竖版 3:4，真实工业产品特写，叠加醒目的问题式标题区域，背景简洁，高对比但不过度营销。",
        "知识卡 1，竖版 3:4，三栏图标化展示连续运行、频繁启停、负载变化，留白充足，适合后期加短句。",
        "知识卡 2，竖版 3:4，工程师记录温升、停机和维护频次，画面可信，颜色清爽。",
        "知识卡 3，竖版 3:4，核验清单、产品和测试设备同框，突出可收藏的清单感。"
      ],
      nextAction: "人工确认逐页文案与视觉风格后，生成图片卡片草稿。"
    },
    {
      id: "xhs_video_script",
      platform: "小红书短视频",
      title: "别只看参数：30 秒看懂稳定性该怎么验证",
      format: "口播稿、镜头节奏与结尾引导",
      strategy: "小红书短视频要先抓注意力，再快速给判断框架：口播短句、镜头动作明确、结尾引导评论或私信。",
      copy: `【0-3 秒】\n口播：工业产品选得对不对，先别只看参数，先看它能不能在你的工况里稳定跑下去。\n画面：设备运行特写，叠加“稳定不等于口号”。\n\n【4-15 秒】\n口播：连续运行多久、负载怎么变化、现场安装条件怎样，这三个问题不清楚，任何性能描述都很难落地。\n画面：依次展示运行时长、负载、安装环境三个信息点。\n\n【16-25 秒】\n口播：围绕“${requirement}”，把要验证的指标列成清单，再决定方案是否值得投入测试。\n画面：技术人员勾选核验清单。\n\n【26-30 秒】\n口播：把你的使用场景发来，我们一起把需要验证的重点列清楚。\n画面：干净产品画面与咨询引导。`,
      imagePrompts: [
        "短视频首帧，9:16，工业产品运行特写，主体清晰，顶部留标题空间，真实质感，不要虚构夸张数据。",
        "转场关键帧，9:16，工程师把运行时长、负载、安装条件写入核验清单，手部动作自然，适合图生视频。"
      ],
      nextAction: "人工审核口播、画面和证据边界后，再进入首帧与视频生产。"
    },
    {
      id: "video_asset_pack",
      platform: "视频资产包",
      title: "配音与镜头内容包",
      format: "配音稿、镜头重点、资产提示词与审核项",
      strategy: "视频资产包服务后续生成链路：减少发布口吻，强化资产一致性、镜头引用、配音边界和 QC 标准。",
      copy: "【配音主线】\n稳定性不能只靠一句卖点证明，要回到真实工况和可核验指标。\n\n【镜头重点】\n第一镜建立产品与场景；第二镜展示连续运行、负载和安装条件；第三镜呈现核验清单与咨询引导。\n\n【审核项】\n不夸大性能；不使用无法证明的数据；产品外观、场景与文字信息保持一致。",
      imagePrompts: [
        "风格资产 STYLE00：工业质感、真实产品摄影、克制灯光、清晰材质、低饱和背景，统一后续全部镜头。",
        "产品资产 P01：主产品居中清晰，多个关键角度，禁止变形、错误接口和不真实比例。",
        "场景资产 S01：无人物工业应用大全景，设备、工作台和背景层次清晰，可作为连续镜头参考。"
      ],
      nextAction: "确认配音、镜头和审核项后，生成对应的视觉资产与视频草稿。"
    }
  ];
  return allProduction.filter((item) => targetPlatforms.includes(item.id));
}

export function buildSkillOrchestration(input: { imageBackend?: ImageBackend; requirement?: string; targetPlatforms?: AigcTargetPlatform[] } = {}): SkillOrchestration {
  const image = input.imageBackend || resolveImageBackend();
  const requirement = input.requirement?.replace(/\s+/g, " ").trim() || "当前创作主题";
  const targetPlatforms = normalizeTargetPlatforms(input.targetPlatforms);
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
    production: buildProduction(requirement, targetPlatforms),
    publish: {
      mode: "draft_only",
      requiresHumanApproval: true,
      credentialNames: ["WECHAT_APP_ID", "WECHAT_APP_SECRET"]
    }
  };
}
