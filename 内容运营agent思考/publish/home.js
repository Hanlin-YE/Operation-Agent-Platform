const modules = {
  overview: {
    kicker: "Workspace",
    listTitle: "内容输入队列",
    feedKicker: "Queue",
    feedTitle: "最近条目",
    feedCount: "3 条",
    eyebrow: "Knowledge Publishing OS",
    title: "把输入变成可分享的知识资产",
    status: "总览",
    heroKicker: "Today",
    heroTitle: "AI 活动复盘正在变成一组内容资产",
    heroCopy: "这批材料已经拆成 7 条有效信息、4 条行动项、3 个发布草稿和 12 条证据索引。",
    entry: {
      icon: "IN",
      title: "素材输入与预览",
      copy: "会议照片、录音、截图、PDF、文本先在这里进入知识库。",
      action: "进入",
      href: "./inbox.html",
    },
    workflow: ["全局看板", "输入队列", "内容进度", "发布排期"],
    stats: [
      ["7", "有效信息"],
      ["4", "行动项"],
      ["3", "草稿"],
      ["12", "证据"],
    ],
    feed: [
      ["高信息密度人群需要信号消化器", "来自上海 AI Event 的圆桌录音与白板整理。", "观点"],
      ["短剧 AIGC 的角色一致性检查", "匹配 AIGC workflow 与 EigenFlux 内容生产线。", "项目"],
      ["会后素材不应停在原始文件层", "可延展为公众号开头和产品定位。", "金句"],
    ],
    detailKicker: "Draft",
    detailTitle: "新文档：会议素材为什么需要被消化",
    detailStatus: "草稿 64%",
    detailBlocks: [
      ["内容大纲", "从“收集素材”到“形成下一步”", "开头用痛点切入：不是没有记录，而是记录没有进入工作系统。"],
      ["核心论点", "原始素材只有和行动、选题、证据绑定，才会成为认知资产。", "可引用白板待办、圆桌录音和活动海报作为证据链。"],
      ["发布版本", "朋友圈、X、公众号三个版本已排队。", "短内容先发观点，长内容再展开产品故事。"],
    ],
    inspectorTitle: "证据库",
    inspectorCount: "12 条",
    inspector: [
      ["“不是没有记录，而是记录没有进入工作系统”", "来源：roundtable_audio_3min.m4a / 00:42"],
      ["“角色一致性、批量生成、审核成本”", "来源：IMG_001_PPT_short_drama_agent.jpg"],
      ["“联系林老师确认 Agent-to-Agent demo”", "来源：IMG_002_whiteboard_followups.jpg"],
    ],
  },
  inbox: {
    kicker: "Input",
    listTitle: "待消化素材",
    feedKicker: "Raw",
    feedTitle: "素材批次",
    feedCount: "4 批",
    eyebrow: "Material Workflow",
    title: "先看见原始素材，再让它进入知识加工",
    status: "输入侧",
    heroKicker: "Current Batch",
    heroTitle: "会议照片、录音和截图会先形成可预览输入流",
    heroCopy: "素材不是直接被总结掉，而是先保留证据形态：图片可放大、音频可播放、文本可读取、PDF 可预览。",
    entry: {
      icon: "GO",
      title: "打开素材输入分页",
      copy: "进入已经做好的导入、预览、生成知识包页面。",
      action: "打开",
      href: "./inbox.html",
    },
    workflow: ["导入素材", "自动分类", "补充 OCR/转写", "生成知识包", "证据回链"],
    stats: [
      ["5", "文件类型"],
      ["0", "云上传"],
      ["1", "演示批次"],
      ["5", "输出视图"],
    ],
    feed: [
      ["2026-06-06 上海 AI Event", "PPT、白板、海报、录音、微信笔记。", "会议"],
      ["AIGC workflow 线索", "角色一致性、批量生成、审核成本。", "项目"],
      ["个人知识工作流入口", "可搜索、可回顾、可行动的会后记忆。", "定位"],
    ],
    detailKicker: "Inbox",
    detailTitle: "素材输入分页已经作为下设工作台",
    detailStatus: "可使用",
    detailBlocks: [
      ["导入", "支持图片、音频、视频、PDF、文本和 Office 文件。", "浏览器内本地预览，不需要先上传到服务端。"],
      ["预览", "图片导入后立即出现在素材流里。", "这正是你说的：原始素材应该往前挪，导入时就可以看到。"],
      ["消化", "点击生成知识包后，输出行动、机会、发布稿和证据索引。", "后续可以把 OCR/ASR/API 接进这个位置。"],
    ],
    inspectorTitle: "可识别材料",
    inspectorCount: "6 类",
    inspector: [
      ["图片 / 截图", "预览、分类、备注 OCR 线索。"],
      ["音频 / 视频", "播放、分类、备注转写。"],
      ["文本 / Markdown", "直接读取并进入分析语料。"],
    ],
  },
  cards: {
    kicker: "Cards",
    listTitle: "知识卡片库",
    feedKicker: "Cards",
    feedTitle: "待整理卡片",
    feedCount: "24 张",
    eyebrow: "Card Workflow",
    title: "把会议材料拆成可复用的观点、实体和案例",
    status: "卡片化",
    heroKicker: "Card Set",
    heroTitle: "一场会可以沉淀出多个长期可用的知识单元",
    heroCopy: "每张卡片都保留来源、适用栏目、可引用句子和下一步用途。",
    entry: {
      icon: "KC",
      title: "从新素材生成卡片",
      copy: "素材输入分页产出的知识包会进入这里继续拆分。",
      action: "整理",
      href: "./inbox.html",
    },
    workflow: ["抽取观点", "合并重复", "绑定栏目", "生成引用"],
    stats: [
      ["11", "观点"],
      ["6", "人物/机构"],
      ["4", "项目"],
      ["3", "金句"],
    ],
    feed: [
      ["记录没有进入工作系统", "适合产品定位、长文开头。", "观点"],
      ["短剧生产的审核成本", "适合 AIGC workflow 项目页。", "案例"],
      ["AI agent 实习招聘", "适合人脉和机会跟进。", "线索"],
    ],
    detailKicker: "Card",
    detailTitle: "卡片：记录工具越多，记忆反而越少",
    detailStatus: "已标注",
    detailBlocks: [
      ["论点", "记录本身不是记忆，能被搜索、行动和复用才是记忆。", "这句话可以成为产品介绍页的主论点。"],
      ["适用栏目", "知识工作流、AI 工具、个人生产力。", "可以派生出 3 条短内容和 1 篇长文。"],
      ["证据", "圆桌录音 00:42 与白板照片互相印证。", "发布时可以回到具体来源。"],
    ],
    inspectorTitle: "关联证据",
    inspectorCount: "3 条",
    inspector: [
      ["roundtable_audio_3min.m4a / 00:42", "嘉宾提到记录没有进入工作系统。"],
      ["IMG_002_whiteboard_followups.jpg", "白板里出现会后跟进事项。"],
      ["notes_wechat_forward.md", "会后朋友圈草稿。"],
    ],
  },
  topics: {
    kicker: "Topics",
    listTitle: "选题池",
    feedKicker: "Topics",
    feedTitle: "待推进选题",
    feedCount: "8 个",
    eyebrow: "Topic Workflow",
    title: "把知识卡片匹配成可发布选题",
    status: "选题",
    heroKicker: "Next",
    heroTitle: "最值得写的是：为什么记录工具越多，记忆反而越少？",
    heroCopy: "这个选题同时连接产品痛点、个人经历和 AfterMeet 的 demo 能力。",
    entry: {
      icon: "TP",
      title: "从素材里找新选题",
      copy: "输入新会议材料，让系统生成可发布角度。",
      action: "生成",
      href: "./inbox.html",
    },
    workflow: ["选题生成", "栏目匹配", "证据检查", "排期"],
    stats: [
      ["8", "候选"],
      ["3", "高优先级"],
      ["2", "可长文"],
      ["5", "可短发"],
    ],
    feed: [
      ["为什么记录工具越多，记忆反而越少？", "公众号 / 长文", "P0"],
      ["会议照片如何变成 5 分钟回看版", "X / Demo", "P1"],
      ["知识库的输入侧应该长什么样", "产品日志", "P1"],
    ],
    detailKicker: "Topic",
    detailTitle: "选题：会议照片如何变成 5 分钟回看版",
    detailStatus: "待写",
    detailBlocks: [
      ["切入", "先展示 Before：一堆照片、录音、截图。", "再展示 After：行动、机会、证据和发布稿。"],
      ["受众", "高信息密度但没时间回看材料的人。", "包括活动参与者、创作者、投资/产品/研究人员。"],
      ["输出", "一条 X、一个 demo 视频、一篇产品日志。", "先短后长。"],
    ],
    inspectorTitle: "选题证据",
    inspectorCount: "5 条",
    inspector: [
      ["白板待办", "证明素材里有行动项。"],
      ["活动海报", "证明素材里有机会和链接。"],
      ["录音观点", "证明素材里有可发布观点。"],
    ],
  },
  writing: {
    kicker: "Writing",
    listTitle: "写作台",
    feedKicker: "Drafts",
    feedTitle: "草稿队列",
    feedCount: "3 篇",
    eyebrow: "Writing Workflow",
    title: "把选题、证据和个人项目资产合成草稿",
    status: "写作",
    heroKicker: "Draft",
    heroTitle: "新文档：会后信号消化器",
    heroCopy: "草稿从知识卡片生成，但保留证据索引，避免变成空泛总结。",
    entry: {
      icon: "WR",
      title: "用新素材补强草稿",
      copy: "先导入材料，再把有效信息追加到当前文档。",
      action: "补充",
      href: "./inbox.html",
    },
    workflow: ["选择选题", "拼装大纲", "引用证据", "生成多平台版本"],
    stats: [
      ["64%", "当前草稿"],
      ["3", "平台版本"],
      ["6", "引用"],
      ["2", "缺口"],
    ],
    feed: [
      ["会后信号消化器", "产品日志，已完成 64%。", "草稿"],
      ["记录不等于记忆", "观点短文，等待证据。", "待补"],
      ["AIGC workflow 的会议线索", "项目更新，待写。", "排队"],
    ],
    detailKicker: "Draft",
    detailTitle: "新文档：会后信号消化器",
    detailStatus: "草稿 64%",
    detailBlocks: [
      ["开头", "我不是没有记录，而是永远没时间看记录。", "把用户原话作为第一屏的真实痛点。"],
      ["主体", "素材输入、知识卡片、选题池、写作台、证据库组成闭环。", "用当前产品结构解释长期愿景。"],
      ["结尾", "AfterMeet 不是转写工具，而是会后信号消化器。", "收束到产品定位。"],
    ],
    inspectorTitle: "写作素材",
    inspectorCount: "6 条",
    inspector: [
      ["用户痛点", "整理照片和音频，但没有时间看。"],
      ["产品定位", "Personal conference memory agent。"],
      ["Demo 输出", "5 分钟回看、行动、机会、发布稿、证据。"],
    ],
  },
  evidence: {
    kicker: "Evidence",
    listTitle: "证据库",
    feedKicker: "Sources",
    feedTitle: "证据来源",
    feedCount: "42 条",
    eyebrow: "Evidence Workflow",
    title: "让每个结论都能回到原始素材",
    status: "证据",
    heroKicker: "Traceable",
    heroTitle: "观点、待办和发布稿都要能追溯来源",
    heroCopy: "证据库保存素材名、时间点、截图区域和关联结论，减少空泛总结。",
    entry: {
      icon: "EV",
      title: "补充新证据",
      copy: "从素材输入分页导入图片、音频、PDF 和文本。",
      action: "导入",
      href: "./inbox.html",
    },
    workflow: ["来源入库", "结论绑定", "引用检查", "导出证据"],
    stats: [
      ["42", "证据"],
      ["18", "已绑定"],
      ["9", "待核验"],
      ["5", "可引用"],
    ],
    feed: [
      ["roundtable_audio_3min.m4a / 00:42", "记录没有进入工作系统。", "录音"],
      ["IMG_001_PPT_short_drama_agent.jpg", "短剧 AIGC 生产痛点。", "图片"],
      ["IMG_003_event_poster_shanghai_ai.jpg", "上海 AI 活动报名信息。", "海报"],
    ],
    detailKicker: "Evidence",
    detailTitle: "证据：记录没有进入工作系统",
    detailStatus: "已绑定",
    detailBlocks: [
      ["结论", "会议材料的价值在于进入工作系统。", "该结论被用于产品定位和文章开头。"],
      ["来源", "圆桌录音 00:42，微信笔记二次确认。", "后续可接真实 ASR 时间戳。"],
      ["使用位置", "知识卡片、选题、公众号草稿。", "每次发布都带回链。"],
    ],
    inspectorTitle: "相关结论",
    inspectorCount: "4 个",
    inspector: [
      ["产品定位", "AfterMeet 是会后信号消化器。"],
      ["用户痛点", "收集材料但没有时间回看。"],
      ["写作切入", "记录工具越多，记忆反而越少。"],
    ],
  },
  publish: {
    kicker: "Publish",
    listTitle: "发布计划",
    feedKicker: "Calendar",
    feedTitle: "待发布内容",
    feedCount: "5 条",
    eyebrow: "Publish Workflow",
    title: "把同一组知识资产分发到不同平台",
    status: "发布",
    heroKicker: "Schedule",
    heroTitle: "朋友圈、X、公众号和项目日志共用同一组证据",
    heroCopy: "短内容先验证观点，长内容沉淀产品叙事，所有版本回到同一证据库。",
    entry: {
      icon: "PB",
      title: "生成发布草稿",
      copy: "从素材输入分页生成多平台 publish snippets。",
      action: "生成",
      href: "./inbox.html",
    },
    workflow: ["选择平台", "改写语气", "绑定证据", "排期发布"],
    stats: [
      ["2", "今日"],
      ["5", "本周"],
      ["3", "待审"],
      ["1", "已排期"],
    ],
    feed: [
      ["朋友圈：高信息密度人群缺的不是记录工具", "今天 20:30", "短文"],
      ["X：Meeting notes are not memory", "明天 09:00", "英文"],
      ["公众号：会后信号消化器", "周三", "长文"],
    ],
    detailKicker: "Publish",
    detailTitle: "发布包：会后信号消化器",
    detailStatus: "待审",
    detailBlocks: [
      ["朋友圈", "今天最有启发的一点：记录只有进入行动系统才会变成资产。", "短、真实、有个人感。"],
      ["X", "Meeting notes are not memory. Memory starts when raw signals become searchable evidence.", "英文版保持产品定位清晰。"],
      ["公众号", "从真实痛点讲到 AfterMeet v0 的工作流。", "附 demo 截图。"],
    ],
    inspectorTitle: "发布素材",
    inspectorCount: "3 平台",
    inspector: [
      ["朋友圈", "观点验证。"],
      ["X", "产品定位与英文受众。"],
      ["公众号", "完整故事和 demo。"],
    ],
  },
  review: {
    kicker: "Review",
    listTitle: "数据复盘",
    feedKicker: "Signals",
    feedTitle: "内容反馈",
    feedCount: "4 组",
    eyebrow: "Review Workflow",
    title: "从发布反馈反推下一轮知识输入",
    status: "复盘",
    heroKicker: "Learning",
    heroTitle: "哪些观点值得继续写，哪些证据还不够",
    heroCopy: "复盘不是看数据热闹，而是把反馈变成新的素材输入和选题优先级。",
    entry: {
      icon: "RV",
      title: "用新反馈补充知识库",
      copy: "把评论、私信、群聊截图放回素材输入。",
      action: "回收",
      href: "./inbox.html",
    },
    workflow: ["采集反馈", "归因主题", "更新选题", "生成下一步"],
    stats: [
      ["4", "反馈组"],
      ["2", "新选题"],
      ["5", "问题"],
      ["1", "合作线索"],
    ],
    feed: [
      ["大家最关心 OCR/ASR 是否自动化", "可转为技术路线文章。", "问题"],
      ["有人问能否接微信文件夹", "可转为集成路线。", "需求"],
      ["对证据索引反应最好", "保留为核心卖点。", "洞察"],
    ],
    detailKicker: "Review",
    detailTitle: "复盘：证据索引是最强卖点",
    detailStatus: "已记录",
    detailBlocks: [
      ["现象", "用户对“每个结论都能回到来源”反应更强。", "这说明产品要避免普通总结工具定位。"],
      ["下一步", "加强证据库、截图定位、音频时间戳。", "导入侧要继续前置原始素材预览。"],
      ["新选题", "为什么 AI 总结需要证据索引？", "适合长文。"],
    ],
    inspectorTitle: "反馈来源",
    inspectorCount: "4 条",
    inspector: [
      ["聊天反馈", "原始素材要往前挪。"],
      ["参考图", "两级工作台架构。"],
      ["上线反馈", "Cloudflare Pages 作为 dev 部署。"],
    ],
  },
  settings: {
    kicker: "Settings",
    listTitle: "系统设置",
    feedKicker: "Config",
    feedTitle: "配置项",
    feedCount: "5 项",
    eyebrow: "System Workflow",
    title: "管理栏目资产、模型能力和部署方式",
    status: "设置",
    heroKicker: "Admin",
    heroTitle: "把个人知识库变成稳定的内容生产系统",
    heroCopy: "这里未来配置项目记忆、OCR/ASR、发布平台、证据格式和 Cloudflare Pages 部署。",
    entry: {
      icon: "CF",
      title: "Dev 部署机制",
      copy: "当前站点使用 Cloudflare Pages / Wrangler 上线。",
      action: "查看",
      href: "./inbox.html",
    },
    workflow: ["项目记忆", "识别能力", "发布平台", "部署设置"],
    stats: [
      ["6", "栏目"],
      ["3", "模型接口"],
      ["4", "平台"],
      ["1", "部署目标"],
    ],
    feed: [
      ["Cloudflare Pages", "dev 上线默认目标。", "部署"],
      ["OCR / Vision", "后续接图片识别。", "模型"],
      ["Whisper / ASR", "后续接音频转写。", "模型"],
    ],
    detailKicker: "Settings",
    detailTitle: "配置：Cloudflare Pages dev 部署",
    detailStatus: "已采用",
    detailBlocks: [
      ["部署", "使用 Wrangler 发布到 aftermeet-memory-inbox.pages.dev。", "后续 dev 上线沿用这个机制。"],
      ["识别", "当前是本地预览 + 手动备注，后续接 OCR/ASR。", "保留静态 demo 的可用性。"],
      ["项目记忆", "栏目资产用于 Opportunity Matcher。", "每次会议材料都会匹配既有项目。"],
    ],
    inspectorTitle: "系统记忆",
    inspectorCount: "3 条",
    inspector: [
      ["上线", "dev 部署使用 Cloudflare Pages。"],
      ["产品结构", "左侧 1-9，全局模块；顶部是模块内流程。"],
      ["输入侧", "素材导入时先展示原始预览。"],
    ],
  },
};

const els = {
  navLinks: [...document.querySelectorAll(".home-nav-link")],
  workflow: document.querySelector("#module-workflow"),
  moduleKicker: document.querySelector("#module-kicker"),
  moduleListTitle: document.querySelector("#module-list-title"),
  feedKicker: document.querySelector("#feed-kicker"),
  feedTitle: document.querySelector("#feed-title"),
  feedCount: document.querySelector("#feed-count"),
  moduleEntry: document.querySelector("#module-entry"),
  moduleFeed: document.querySelector("#module-feed"),
  moduleEyebrow: document.querySelector("#module-eyebrow"),
  moduleTitle: document.querySelector("#module-title"),
  moduleStatus: document.querySelector("#module-status"),
  heroKicker: document.querySelector("#hero-kicker"),
  heroTitle: document.querySelector("#hero-title"),
  heroCopy: document.querySelector("#hero-copy"),
  moduleStats: document.querySelector("#module-stats"),
  pipelinePanel: document.querySelector("#pipeline-panel"),
  detailKicker: document.querySelector("#detail-kicker"),
  detailTitle: document.querySelector("#detail-title"),
  detailStatus: document.querySelector("#detail-status"),
  detailBlocks: document.querySelector("#detail-blocks"),
  inspectorTitle: document.querySelector("#inspector-title"),
  inspectorCount: document.querySelector("#inspector-count"),
  inspectorItems: document.querySelector("#inspector-items"),
  moduleJumps: [...document.querySelectorAll("[data-module-jump]")],
};

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderModule(moduleId) {
  const module = modules[moduleId] || modules.overview;
  els.navLinks.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.module === moduleId);
  });

  els.workflow.innerHTML = module.workflow
    .map(
      (item, index) => `
        <button class="workflow-step ${index === 0 ? "is-active" : ""}" type="button">
          <span>${String(index + 1).padStart(2, "0")}</span>
          ${escapeHtml(item)}
        </button>
      `,
    )
    .join("");

  els.moduleKicker.textContent = module.kicker;
  els.moduleListTitle.textContent = module.listTitle;
  els.feedKicker.textContent = module.feedKicker;
  els.feedTitle.textContent = module.feedTitle;
  els.feedCount.textContent = module.feedCount;
  els.moduleEyebrow.textContent = module.eyebrow;
  els.moduleTitle.textContent = module.title;
  els.moduleStatus.textContent = module.status;
  els.heroKicker.textContent = module.heroKicker;
  els.heroTitle.textContent = module.heroTitle;
  els.heroCopy.textContent = module.heroCopy;
  els.detailKicker.textContent = module.detailKicker;
  els.detailTitle.textContent = module.detailTitle;
  els.detailStatus.textContent = module.detailStatus;
  els.inspectorTitle.textContent = module.inspectorTitle;
  els.inspectorCount.textContent = module.inspectorCount;

  els.moduleEntry.href = module.entry.href;
  els.moduleEntry.innerHTML = `
    <span class="entry-icon" aria-hidden="true">${escapeHtml(module.entry.icon)}</span>
    <div>
      <strong>${escapeHtml(module.entry.title)}</strong>
      <p>${escapeHtml(module.entry.copy)}</p>
    </div>
    <b>${escapeHtml(module.entry.action)}</b>
  `;

  els.moduleFeed.innerHTML = module.feed
    .map(
      ([title, copy, label], index) => `
        <article class="feed-card ${index === 0 ? "is-selected" : ""}">
          <div class="feed-card-main">
            <strong>${escapeHtml(title)}</strong>
            <p>${escapeHtml(copy)}</p>
          </div>
          <span>${escapeHtml(label)}</span>
        </article>
      `,
    )
    .join("");

  els.moduleStats.innerHTML = module.stats
    .map(
      ([value, label]) => `
        <div>
          <b>${escapeHtml(value)}</b>
          <span>${escapeHtml(label)}</span>
        </div>
      `,
    )
    .join("");

  els.pipelinePanel.innerHTML = module.workflow
    .map(
      (item, index) => `
        <div class="pipeline-step ${index === 0 ? "is-active" : ""}">
          <span>${String(index + 1).padStart(2, "0")}</span>
          <strong>${escapeHtml(item)}</strong>
          <p>${index === 0 ? "当前步骤" : "流程节点"}</p>
        </div>
      `,
    )
    .join("");

  els.detailBlocks.innerHTML = module.detailBlocks
    .map(
      ([label, title, copy]) => `
        <div class="draft-block">
          <span>${escapeHtml(label)}</span>
          <strong>${escapeHtml(title)}</strong>
          <p>${escapeHtml(copy)}</p>
        </div>
      `,
    )
    .join("");

  els.inspectorItems.innerHTML = module.inspector
    .map(
      ([title, copy]) => `
        <div class="evidence-mini">
          <strong>${escapeHtml(title)}</strong>
          <p>${escapeHtml(copy)}</p>
        </div>
      `,
    )
    .join("");
}

els.navLinks.forEach((button) => {
  button.addEventListener("click", () => {
    renderModule(button.dataset.module);
    history.replaceState(null, "", `#${button.dataset.module}`);
  });
});

els.moduleJumps.forEach((button) => {
  button.addEventListener("click", () => {
    renderModule(button.dataset.moduleJump);
    history.replaceState(null, "", `#${button.dataset.moduleJump}`);
  });
});

const initialModule = location.hash.replace("#", "") || "overview";
renderModule(modules[initialModule] ? initialModule : "overview");
