import { Lead } from "@/server/data/types";
import { scoreLeadByRules } from "./rules";

export function buildScoreExplanation(lead: Lead) {
  const score = scoreLeadByRules(lead);
  const reasons: string[] = [];

  if (score.industryScore >= 20) reasons.push("行业与电机高需求场景匹配，具备较明确的采购可能。");
  else reasons.push("行业匹配信息不足，需要进一步确认是否存在稳定电机使用场景。");

  if (score.useCaseScore >= 20) reasons.push("备注或标签中出现泵、输送线、变频、节能改造等明确应用线索。");
  else reasons.push("暂未发现清晰应用场景，首次沟通应优先确认设备和工况。");

  if (score.contactScore >= 14) reasons.push("联系人角色接近采购、技术或管理决策链，适合直接推进需求确认。");
  else reasons.push("联系人决策影响力不明确，建议补充采购或技术负责人信息。");

  if (score.riskPenalty < 0) reasons.push("存在价格敏感、贸易商或需求不稳定风险，建议控制投入节奏。");

  const recommendedAction =
    score.grade === "A"
      ? "优先跟进：建议当天电话触达，并围绕具体工况确认选型参数。"
      : score.grade === "B"
        ? "重点培育：建议先发微信/邮件建立专业认知，再预约技术沟通。"
        : score.grade === "C"
          ? "低成本触达：建议使用标准开发信，等待明确需求后再投入售前资源。"
          : "暂缓：建议补充信息或进入长期培育池。";

  return {
    ...score,
    reasons,
    recommendedAction,
    modelVersion: "rules-v1 + sales-agent-demo"
  };
}
