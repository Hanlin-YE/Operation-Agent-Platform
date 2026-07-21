import type { CompanyPersona, Product } from "@/server/data/types";

type KnowledgeSnippet = { title: string; content: string };

export type RagSearchHit = {
  chunk_id: string;
  text: string;
  score: number;
  citation: {
    document_id: string;
    title: string;
    document_type: string;
    source_url: string | null;
    page_number: number;
    section_path: string | null;
    claim_number: string | null;
    quote: string;
  };
};

function compact(value: string, limit = 700) {
  const text = value.replace(/\s+/g, " ").trim();
  return text.length > limit ? `${text.slice(0, limit - 3)}...` : text;
}

export function buildKnowledgeContext(question: string, knowledge: KnowledgeSnippet[]) {
  const query = question.toLocaleLowerCase();
  const ranked = knowledge
    .map((item) => {
      const tokens = `${item.title} ${item.content}`
        .toLocaleLowerCase()
        .split(/\s|，|。|、|；|：|,|\.|;|:/)
        .filter((word) => word.length > 1);
      const score = tokens.reduce((sum, word) => sum + (query.includes(word) ? 1 : 0), 0);
      return { item, score };
    })
    .sort((left, right) => right.score - left.score)
    .slice(0, 5);

  const selected = ranked.some((entry) => entry.score > 0) ? ranked.filter((entry) => entry.score > 0) : ranked.slice(0, 3);
  return selected
    .map(({ item }, index) => `内部资料 ${index + 1}\n标题：${item.title}\n要点：${compact(item.content)}`)
    .join("\n\n");
}

export function buildSalesScriptCoachContext() {
  return [
    "营销话术训练人格（专业销售教练）",
    "角色定位：你是一个富有经验的销售，熟读销售与心理学经典。你的任务不是替用户强行成交，而是温柔引导、陪练复盘，帮助用户提升销售沟通能力。",
    "训练风格：温柔、耐心、尊重用户，不羞辱、不压迫；优先用提问、复盘、改写、角色扮演帮助用户自己理解客户心理。",
    "《影响力》原则：客户购买常受互惠、承诺与一致、社会认同、喜好、权威、稀缺影响。销售应用这些原则时应降低客户决策成本，建立信任和心理安全感，不操纵客户。",
    "《SPIN销售》原则：销售不是说服，而是通过情景问题、问题问题、暗示问题、需求收益问题，引导客户自己意识到问题、损失和解决价值。",
    "《关键对话》原则：高压力沟通中先建立共同目标和对话安全感；面对价格、竞品、质疑时先倾听和确认，再把对抗转成共同解决问题。",
    "《定位》原则：客户记不住所有优势，话术要聚焦一个清晰、差异化、容易记住的心智位置，用一句话讲清价值。",
    "《绝对成交话术内训手册》原则：话术不是模板，而是围绕客户心理的流程：建立关系、激发兴趣、需求挖掘、价值呈现、异议处理、促成成交。面对异议要先认同，再引导。",
    "输出要求：每次回答尽量给出：1）温柔诊断；2）沟通原则；3）可直接使用的话术；4）可以继续追问客户的问题；5）下一步练习动作。引用理论时要转成实战建议，不做长篇书摘。",
  ].join("\n");
}

export function buildCompanyPersonaContext(persona: CompanyPersona) {
  return [
    "当前市场训练对象（企业蒸馏画像）",
    `企业名称：${persona.companyName}`,
    `别名：${persona.aliases.join("、")}`,
    `资料来源：${persona.source}${persona.sourceUrl ? `（${persona.sourceUrl}）` : ""}`,
    `行业：${persona.industry}`,
    `区域：${persona.region}`,
    `画像摘要：${persona.businessSummary}`,
    `可能需求：${persona.likelyNeeds.join("；")}`,
    `可能痛点：${persona.painPoints.join("；")}`,
    `购买/决策相关角色：${persona.buyingCommittee.join("；")}`,
    `对话风格：${persona.conversationStyle}`,
    `建议追问：${persona.qualificationQuestions.join("；")}`,
    `销售切入角度：${persona.salesAngles.join("；")}`,
    `注意事项：${persona.cautions.join("；")}`,
  ].join("\n");
}

export function buildProductCatalogContext(products: Product[]) {
  return products
    .map((product, index) => [
      `公司产品 ${index + 1}`,
      `名称：${product.name}`,
      `品类：${product.category}`,
      `规格范围：${product.powerRange}`,
      `应用场景：${product.useCases.join("、")}`,
      `核心卖点：${product.sellingPoints.join("、")}`,
      `备注：${product.notes}`,
    ].join("\n"))
    .join("\n\n");
}

export function buildProductRagContext(hits: RagSearchHit[]) {
  return hits
    .slice(0, 5)
    .map((hit, index) => `内部产品资料 ${index + 1}\n主题：${hit.citation.title}\n要点：${compact(hit.text)}`)
    .join("\n\n");
}
