import { Lead } from "@/server/data/types";

export type AccountTier = "KA" | "LA" | "SMB";
export type RoutingPolicy = "HUMAN_REQUIRED" | "HUMAN_APPROVAL" | "NURTURE_AUTOMATION";

export function deriveAccountRouting(lead: Pick<Lead, "companyName" | "region" | "companySize" | "tags">) {
  const corpus = `${lead.companyName} ${lead.region} ${lead.companySize} ${lead.tags.join(" ")}`;
  if (/(集团|全国|战略|头部|top\s?\d)/i.test(corpus)) {
    return { accountTier: "KA" as const, routingPolicy: "HUMAN_REQUIRED" as const, tierReason: "全国布局或战略 B 端账户，必须由客户经理人工沟通。" };
  }
  if (/(深圳|广州|上海|北京|苏州|本地|区域)/.test(corpus)) {
    return { accountTier: "LA" as const, routingPolicy: "HUMAN_APPROVAL" as const, tierReason: "本地 B 端账户，关键对外内容需人工审核。" };
  }
  return { accountTier: "SMB" as const, routingPolicy: "NURTURE_AUTOMATION" as const, tierReason: "进入授权与频控下的标准化内容培育。" };
}
