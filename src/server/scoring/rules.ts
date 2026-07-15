import { Lead } from "@/server/data/types";

const highFitIndustries = ["自动化", "设备", "泵", "风机", "压缩", "机器人", "包装", "输送", "矿山", "化工"];
const applicationKeywords = ["泵", "风机", "输送", "产线", "压缩", "变频", "节能", "替换", "扩产", "设备"];
const urgencyKeywords = ["近期", "询问", "扩产", "替换", "报价", "交期", "项目", "改造"];
const riskKeywords = ["贸易", "比价", "低价", "不稳定", "信息缺失", "无联系人"];

function includesAny(text: string, keywords: string[]) {
  return keywords.some((keyword) => text.includes(keyword));
}

export function scoreLeadByRules(lead: Lead) {
  const corpus = `${lead.companyName} ${lead.industry} ${lead.companySize} ${lead.contactTitle} ${lead.tags.join(" ")} ${lead.notes}`;

  const industryScore = includesAny(`${lead.industry} ${lead.companyName}`, highFitIndustries) ? 24 : 10;
  const useCaseScore = includesAny(corpus, applicationKeywords) ? 22 : 8;

  let companyFitScore = 8;
  if (lead.companySize.includes("500") || lead.companySize.includes("1000")) companyFitScore = 15;
  else if (lead.companySize.includes("200")) companyFitScore = 13;
  else if (lead.companySize.includes("50")) companyFitScore = 9;

  let contactScore = 6;
  if (lead.contactTitle.includes("采购") || lead.contactTitle.includes("技术") || lead.contactTitle.includes("经理")) contactScore = 14;
  if (lead.contactTitle.includes("总") || lead.contactTitle.includes("老板")) contactScore = 15;

  const urgencyScore = includesAny(corpus, urgencyKeywords) ? 9 : 3;
  const riskPenalty = includesAny(corpus, riskKeywords) ? -14 : 0;

  const totalScore = Math.max(
    0,
    Math.min(100, industryScore + useCaseScore + companyFitScore + contactScore + urgencyScore + riskPenalty)
  );

  const grade = totalScore >= 80 ? "A" : totalScore >= 65 ? "B" : totalScore >= 45 ? "C" : "D";

  return {
    totalScore,
    grade,
    industryScore,
    useCaseScore,
    companyFitScore,
    contactScore,
    urgencyScore,
    riskPenalty
  } as const;
}
