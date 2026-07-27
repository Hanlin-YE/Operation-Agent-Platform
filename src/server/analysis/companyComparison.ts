import { CompanyComparisonDimension, CompanyComparisonResult, CompanyProfile } from "@/server/data/types";

const dimensions: CompanyComparisonDimension[] = ["主体有效性", "规模与采购能力", "技术积累", "场景匹配度", "需求强度", "风险健康度", "证据可信度"];

function hasRisk(profile: CompanyProfile) {
  return /异常|司法|处罚|注销|吊销|失信|被执行/.test(`${profile.registrationStatus || ""} ${profile.riskSummary}`);
}

function capitalScore(profile: CompanyProfile) {
  const text = profile.registeredCapital || "";
  const number = Number((text.match(/\d+(?:\.\d+)?/) || ["0"])[0]);
  if (number >= 5000) return 14;
  if (number >= 1000) return 11;
  if (number > 0) return 8;
  return 5;
}

function scoreProfile(profile: CompanyProfile) {
  const active = !/注销|吊销|迁出|停业/.test(profile.registrationStatus || "");
  const dimensionScores = [
    { dimension: "主体有效性" as const, score: active ? 15 : 2, reason: active ? "主体状态未见明显失效信号" : "主体状态存在失效风险" },
    { dimension: "规模与采购能力" as const, score: capitalScore(profile) + Math.min(6, profile.procurementSignals.length * 3), reason: profile.procurementSignals.length ? `出现${profile.procurementSignals.join("、")}等采购信号` : "未见明确采购信号，按注册资本和基础信息估算" },
    { dimension: "技术积累" as const, score: Math.min(18, profile.technologySignals.length * 5 + profile.productKeywords.length * 2), reason: profile.technologySignals.length ? `技术关键词：${profile.technologySignals.join("、")}` : "技术积累证据不足" },
    { dimension: "场景匹配度" as const, score: Math.min(18, profile.applicationScenarios.length * 6 + profile.productKeywords.length * 2), reason: profile.applicationScenarios.length ? `命中${profile.applicationScenarios.join("、")}` : "尚未命中优先应用场景" },
    { dimension: "需求强度" as const, score: Math.min(14, profile.painSignals.length * 4 + profile.procurementSignals.length * 3), reason: profile.painSignals.length ? `痛点信号：${profile.painSignals.join("、")}` : "未见明确痛点表达" },
    { dimension: "风险健康度" as const, score: hasRisk(profile) ? 2 : 10, reason: hasRisk(profile) ? "存在风险或异常关键词，需谨慎" : "风险摘要未见高风险关键词" },
    { dimension: "证据可信度" as const, score: Math.min(12, profile.evidenceLinks.length * 4 + (profile.verificationStatus === "已核验" ? 4 : 0)), reason: `${profile.evidenceLinks.length} 条证据，状态：${profile.verificationStatus}` }
  ];
  const totalScore = dimensionScores.reduce((sum, item) => sum + item.score, 0);
  return {
    companyId: profile.id,
    companyName: profile.companyName,
    totalScore,
    priority: totalScore >= 60 && !hasRisk(profile) ? "优先跟进" as const : totalScore >= 35 ? "继续观察" as const : "暂缓" as const,
    dimensionScores,
    recommendedAction: totalScore >= 60 && !hasRisk(profile)
      ? "优先补齐联系人和项目工况，进入技术交流验证。"
      : totalScore >= 35
        ? "继续收集公开证据，确认场景和采购窗口。"
        : "暂缓投入销售资源，先核验主体和真实需求。"
  };
}

export function compareCompanyProfiles(profiles: CompanyProfile[]): CompanyComparisonResult {
  return {
    dimensions,
    items: profiles.map(scoreProfile).sort((left, right) => right.totalScore - left.totalScore),
    generatedAt: new Date().toISOString()
  };
}
