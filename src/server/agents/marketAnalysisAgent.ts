import { MarketAnalysisReport, MarketFocus, MarketSegment } from "@/server/data/types";
import { listKnowledge } from "@/server/repositories/knowledge";
import { listProducts } from "@/server/repositories/products";
import { saveMarketReport } from "@/server/repositories/marketReports";
import { TikhubXiaohongshuSource, XiaohongshuSource } from "@/server/sources/xiaohongshu";

type SegmentBlueprint = Omit<MarketSegment, "id" | "evidence"> & { focus: MarketFocus; evidenceKeywords: string[] };

const blueprints: SegmentBlueprint[] = [
  {
    focus: "robotics",
    name: "人形机器人与灵巧手",
    typicalCustomers: ["人形机器人本体厂", "灵巧手与关节模组厂", "伺服执行器研发团队"],
    demandDrivers: ["高自由度关节小型化", "高频动作可靠性", "样机验证与量产导入"],
    painPoints: ["空间受限", "寿命与维护频率", "温升、响应与控制稳定性"],
    productFit: "高",
    marketPriority: "P0",
    evidenceLabel: "企业知识",
    recommendedEntry: "先锁定研发负责人和关节模组团队，以具体部件、工况和样机测试为技术交流入口。",
    openQuestions: ["目标客户当前采用的电机方案", "寿命/温升测试要求", "样机验证周期与采购角色"],
    evidenceKeywords: ["机器人", "灵巧手", "关节", "空心杯"]
  },
  {
    focus: "medical",
    name: "医疗机器人与精密医疗设备",
    typicalCustomers: ["手术机器人厂", "医疗微泵与精密检测设备厂", "医疗器械研发团队"],
    demandDrivers: ["长期精度保持", "小型化与低维护", "可靠性验证"],
    painPoints: ["长期运行稳定性", "维护窗口有限", "精密动作一致性"],
    productFit: "待验证",
    marketPriority: "P1",
    evidenceLabel: "待市场验证",
    recommendedEntry: "以联合技术验证切入，先确认认证、可靠性测试和现有供应链要求。",
    openQuestions: ["产品是否进入注册/验证阶段", "关键部件的合规要求", "是否允许替代方案送样"],
    evidenceKeywords: ["医疗", "手术", "微泵", "检测"]
  },
  {
    focus: "industrial",
    name: "实验室自动化与精密工业设备",
    typicalCustomers: ["实验室自动化设备厂", "半导体设备厂", "精密运动控制集成商"],
    demandDrivers: ["自动化升级", "高重复精度", "设备稳定交付"],
    painPoints: ["动作一致性", "维护停机成本", "空间与装配兼容性"],
    productFit: "中",
    marketPriority: "P1",
    evidenceLabel: "待市场验证",
    recommendedEntry: "围绕设备关键动作部件建立应用清单，再确认现有方案的可靠性和交期痛点。",
    openQuestions: ["具体设备部件", "年用量与交付节奏", "现有供应商与替换门槛"],
    evidenceKeywords: ["自动化", "实验室", "半导体", "精密"]
  },
  {
    focus: "automotive",
    name: "汽车电子执行器",
    typicalCustomers: ["汽车零部件一级供应商", "执行器模组厂", "车载舒适系统研发团队"],
    demandDrivers: ["静音与快速响应", "可靠性要求", "平台化量产"],
    painPoints: ["噪声控制", "寿命与一致性", "成本和验证周期"],
    productFit: "待验证",
    marketPriority: "P2",
    evidenceLabel: "待市场验证",
    recommendedEntry: "优先确认电动尾门、出风口或中控调节等具体执行器是否适配，再评估车规与量产门槛。",
    openQuestions: ["是否具备车规测试条件", "目标执行器的尺寸/扭矩约束", "量产成本边界"],
    evidenceKeywords: ["汽车", "尾门", "执行器", "静音"]
  },
  {
    focus: "aerospace",
    name: "无人机与航空航天微驱动",
    typicalCustomers: ["无人机整机与云台厂", "航天可动机构团队", "特种装备研发单位"],
    demandDrivers: ["轻量化", "极端环境可靠性", "低维护需求"],
    painPoints: ["重量约束", "环境适应性", "长周期可靠性"],
    productFit: "待验证",
    marketPriority: "P2",
    evidenceLabel: "待市场验证",
    recommendedEntry: "从具体可动部件和测试环境入手，避免先行承诺未经验证的极端环境性能。",
    openQuestions: ["具体载荷与环境条件", "测试标准", "项目保密与供应商准入要求"],
    evidenceKeywords: ["无人机", "航空", "航天", "云台"]
  }
];

function selectBlueprints(focus: MarketFocus) {
  return focus === "all" ? blueprints : blueprints.filter((item) => item.focus === focus);
}

export async function analyzeMarket(focus: MarketFocus = "all", xiaohongshuSource: XiaohongshuSource = new TikhubXiaohongshuSource()) {
  const [products, knowledge, xiaohongshuSignals] = await Promise.all([
    listProducts(), listKnowledge(), xiaohongshuSource.searchSignals({ focus, limit: 8 })
  ]);
  const selected = selectBlueprints(focus);
  const knowledgeText = knowledge.map((item) => `${item.title} ${item.content}`).join(" ");
  const citations = knowledge.slice(0, 5).map((item) => `企业知识：${item.title}`);
  const productNames = products.slice(0, 3).map((item) => item.name).join("、") || "待补充产品资料";
  const segments: MarketSegment[] = selected.map((item) => ({
    id: item.focus,
    name: item.name,
    typicalCustomers: item.typicalCustomers,
    demandDrivers: item.demandDrivers,
    painPoints: item.painPoints,
    productFit: item.productFit,
    marketPriority: item.marketPriority,
    evidenceLabel: item.evidenceKeywords.some((keyword) => knowledgeText.includes(keyword)) ? "企业知识" : "待市场验证",
    evidence: item.evidenceKeywords.filter((keyword) => knowledgeText.includes(keyword)).map((keyword) => `企业知识命中关键词：${keyword}`),
    recommendedEntry: item.recommendedEntry,
    openQuestions: item.openQuestions
  }));
  const report = await saveMarketReport({
    focus,
    title: focus === "all" ? "全市场机会与营销优先级分析" : `${segments[0]?.name || "目标市场"}分析`,
    executiveSummary: `当前可用企业产品资产包括：${productNames}。本报告依据企业知识库生成市场进入假设；未由企业资料或公开来源证实的结论均标记为“待市场验证”，不得直接用于对外性能承诺。`,
    segments,
    competitorWatch: [
      { category: "直接产品竞品", marketSignal: "需持续收集竞品产品、案例、价格与渠道动作。", implication: "建立竞品作战卡，区分事实、公开资料与推断。", evidenceLabel: "待市场验证" },
      { category: "替代方案", marketSignal: "客户可能继续使用现有电机、集成模组或自研方案。", implication: "销售前先确认替换成本、验证门槛与现有供应关系。", evidenceLabel: "推断" }
    ],
    recommendedActions: [
      "选择一个 P0/P1 细分市场，补齐目标企业、关键角色与公开项目证据。",
      "为每个优先市场建立“客户痛点—产品价值—可验证证据”矩阵。",
      "对进入技术交流的客户记录工况、测试标准、样品需求和下一步负责人。"
    ],
    openQuestions: [
      "企业希望优先进入的行业和区域是否已确认？",
      "哪些产品参数、测试报告和客户案例可以作为对外证据？",
      "竞品、价格和目标客户名单由谁审核后进入知识库？"
    ],
    knowledgeCitations: citations.length ? citations : ["待上传企业产品手册、专利或业务资料"],
    xiaohongshuSignals,
    sourceStatus: { xiaohongshu: xiaohongshuSource.status().mode, note: xiaohongshuSource.status().note },
    modelVersion: "market-analysis-rules-v2"
  });
  return report;
}
