import { assertPitchCompliance, pitchSafetyInstruction } from "@/lib/sales/pitchCompliance";
import { PitchChannel } from "@/server/data/types";
import { getLead } from "@/server/repositories/leads";
import { savePitch } from "@/server/repositories/salesArtifacts";
import { generateCompletion } from "@/server/llm/provider";
import { formatKnowledge, formatProduct, retrieveSalesContext } from "@/server/rag/retrieveKnowledge";

const channelLabels: Record<PitchChannel, string> = {
  phone: "电话开场白",
  wechat: "微信首次触达",
  email: "邮件开发信",
  quote_followup: "报价后跟进",
  price_objection: "价格异议处理",
  technical_confirm: "技术参数确认"
};

function fallbackPitch(contactName: string) {
  return `${contactName}您好，我是 Friction X 的销售顾问。想先了解贵司的设备应用、安装空间、负载、运行方式和目标参数，以及目前需要解决的问题。方便的话，我们可以先整理工况与测试要求，再由技术人员确认选型。具体性能、适配结果和交付安排以技术验证及书面确认为准。`;
}

export async function runPitchGenerationAgent(leadId: string, channel: PitchChannel) {
  const lead = await getLead(leadId);
  if (!lead) {
    throw new Error("Lead not found");
  }

  const context = await retrieveSalesContext(lead);
  const primaryProduct = context.products[0];
  const citations = [
    ...context.products.map((product) => `产品：${product.name}`),
    ...context.knowledge.map((item) => `知识：${item.title}`)
  ];

  const system = `你是工业电机销售顾问，生成供人工审核的销售话术。\n${pitchSafetyInstruction}`;
  const user = [
    `客户：${lead.companyName}`,
    `行业：${lead.industry}`,
    `联系人：${lead.contactName} / ${lead.contactTitle}`,
    `备注：${lead.notes}`,
    `渠道：${channelLabels[channel]}`,
    `候选产品：${context.products.map(formatProduct).join("\n")}`,
    `销售知识：${context.knowledge.map(formatKnowledge).join("\n")}`,
    "请生成供人工审核的话术，客户需求以提问确认，不把假设当作事实。"
  ].join("\n");

  const llmContent = await generateCompletion({ system, user });
  const content = llmContent?.trim() || fallbackPitch(lead.contactName);
  assertPitchCompliance(content);

  return savePitch({
    leadId,
    productId: primaryProduct?.id,
    channel,
    scenario: channelLabels[channel],
    content,
    rationale: `${llmContent ? "模型生成，需人工审核。" : "未取得模型结果，使用本地询问模板。"}基于 ${lead.industry} 行业、${lead.contactTitle} 联系人角色、线索备注和 ${context.products.length} 个产品资料生成。`,
    citations
  });
}
