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

function fallbackPitch(params: {
  channel: PitchChannel;
  leadName: string;
  contactName: string;
  productLine: string;
  useCase: string;
  painPoint: string;
}) {
  const title = channelLabels[params.channel];
  if (params.channel === "email") {
    return `主题：关于${params.useCase}场景的电机选型与节能替换建议

${params.contactName}您好，

我是负责工业电机解决方案的销售顾问。看到贵司在${params.useCase}相关场景上可能有稳定运行、交期和能耗控制方面的需求，我们这边的${params.productLine}比较适合做连续运行设备的选型或替换。

我们通常会先确认工况、功率段、运行时长、防护等级和安装尺寸，再给出更稳妥的选型建议，避免只按单价比较导致后续温升、停机或能耗成本偏高。

如果方便，我想和您确认三个问题：当前主要使用在哪类设备上？功率和电压范围大概是多少？近期是新项目选型还是存量替换？

我可以根据这些信息整理一版简短的选型建议给您参考。`;
  }

  if (params.channel === "price_objection") {
    return `${params.contactName}您好，价格这块我理解您肯定要综合比较。我们建议先不只看单台采购价，而是把运行时长、能耗、故障停机和售后响应一起算进去。

以${params.productLine}为例，它更适合${params.useCase}这类连续运行场景。如果贵司设备每天运行时间较长，高效电机在电费和稳定性上的差异会比较明显。

我可以按您当前功率段和运行时长，帮您做一版总拥有成本对比。这样您内部评估时，不只是“哪个便宜”，而是能看到长期成本和风险差异。`;
  }

  if (params.channel === "technical_confirm") {
    return `${params.contactName}您好，为了避免电机选型偏差，我想先和您确认几个关键参数：

1. 设备类型和工况：主要用于${params.useCase}，是连续运行还是间歇运行？
2. 电气参数：功率、电压、频率和是否需要变频调速？
3. 机械参数：转速、安装方式、轴径和安装尺寸是否有限制？
4. 环境要求：是否涉及粉尘、潮湿、高温或防爆要求？
5. 项目节奏：是新设备配套、存量替换，还是节能改造？

确认后我可以给您匹配更合适的型号，减少后续试装和返工风险。`;
  }

  return `${params.contactName}您好，我是做工业电机解决方案的。了解到贵司可能涉及${params.useCase}相关设备，我们的${params.productLine}在稳定运行、选型适配和交期响应上会比较适合。

我这边不是想直接给您推一个型号，而是先确认贵司当前设备的功率、电压、运行时长和工况要求。这样后面给到的建议会更接近实际使用场景，也能避免只看单价带来的后续维护成本。

您看我先问两个问题可以吗：目前这类设备是新项目配套还是旧机替换？主要关注交期、稳定性，还是节能降耗？`;
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

  const system = "你是资深工业电机销售顾问，擅长根据客户画像、工况和产品知识生成专业、克制、可信的销售话术。";
  const user = [
    `客户：${lead.companyName}`,
    `行业：${lead.industry}`,
    `联系人：${lead.contactName} / ${lead.contactTitle}`,
    `备注：${lead.notes}`,
    `渠道：${channelLabels[channel]}`,
    `候选产品：${context.products.map(formatProduct).join("\n")}`,
    `销售知识：${context.knowledge.map(formatKnowledge).join("\n")}`,
    "请生成一段可直接使用的话术，包含客户背景假设、价值点、低打扰式提问和下一步 CTA。"
  ].join("\n");

  const llmContent = await generateCompletion({ system, user });
  const content =
    llmContent ||
    fallbackPitch({
      channel,
      leadName: lead.companyName,
      contactName: lead.contactName,
      productLine: primaryProduct?.name || "高效工业电机",
      useCase: primaryProduct?.useCases[0] || lead.industry,
      painPoint: lead.notes || "稳定运行和选型适配"
    });

  return savePitch({
    leadId,
    productId: primaryProduct?.id,
    channel,
    scenario: channelLabels[channel],
    content,
    rationale: `基于 ${lead.industry} 行业、${lead.contactTitle} 联系人角色、线索备注和 ${context.products.length} 个产品资料生成。`,
    citations
  });
}
