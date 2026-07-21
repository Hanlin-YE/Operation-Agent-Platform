type DeepSeekMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type DeepSeekChatResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  error?: {
    message?: string;
  };
};

export type SalesLearningCategory = "product" | "market" | "script";

const fallbackByCategory: Record<SalesLearningCategory, string> = {
  product: "我暂时无法连接智能问答服务。你可以先描述产品型号、应用场景和客户问题，我会在服务恢复后基于内部产品资料帮你整理复习要点。",
  market: "我暂时无法连接智能问答服务。你可以先补充目标行业、客户类型和竞争情况，我会在服务恢复后基于内部资料帮你梳理市场判断。",
  script: "我暂时无法连接智能问答服务。你可以先写出客户异议或沟通场景，我会在服务恢复后基于内部资料帮你打磨话术。",
};

const categoryLabels: Record<SalesLearningCategory, string> = {
  product: "产品学习",
  market: "市场培训",
  script: "营销话术",
};

function getApiKey() {
  return process.env.DEEPSEEK_API_KEY?.trim();
}

function createSystemPrompt(category: SalesLearningCategory) {
  const basePrompt = [
    "你是一个面向电机/工业产品销售团队的培训助手。",
    `当前培训方向：${categoryLabels[category]}。`,
    "你会收到服务端检索到的内部知识上下文，但这些上下文只用于帮助你组织答案。",
    "禁止逐字复制或大段展示内部知识库原文。",
    "禁止输出来源列表、页码、相关度、文档编号、chunk id 等知识库检索细节。",
    "如果用户询问‘我们公司有什么产品/有哪些产品’，只能依据上下文中的公司产品清单回答；不得引入腾讯云智能客服、腾讯企点营销云或其他上下文没有出现的产品。",
    "如果检索上下文与 Friction X 电机/自超滑/空心杯产品无关，请忽略该上下文，并说明当前内部产品资料不足，不要把无关资料当作公司产品。",
    "如果上下文不足，请明确说明需要用户补充哪些信息，不要编造内部资料。",
    "如果上下文包含‘当前市场训练对象（企业蒸馏画像）’，你正在围绕该目标企业做市场培训对话：先点明当前训练对象，再从该企业可能的技术、采购、经营和市场视角回应。",
    "企业画像中的未核验内容只能作为‘销售假设’表述，不得编造成已发生事实、采购意向、合作关系、营收、联系人、客户名单或证书。",
    "市场培训中的企业画像对话应帮助销售练习：开场、需求确认、痛点挖掘、异议处理和下一步推进。",
    "回答应简洁、可执行，优先给出：结论、销售理解、客户沟通建议、下一步训练动作。",
  ];

  if (category === "script") {
    basePrompt.push(
      "在营销话术方向，你是一个富有经验的销售教练，熟读销售与心理学经典。",
      "你的语气要温柔、耐心、引导式，避免压迫用户或制造焦虑。",
      "训练方式优先使用提问、复盘、改写和角色扮演，而不是直接灌输标准答案。",
      "你要能把用户的话术或客户场景拆解到：关系建立、需求挖掘、价值表达、异议处理、成交推进。",
      "引用销售理论时必须转化成实战建议，不做长篇书摘，不堆砌理论名词。",
      "面对用户给出的粗糙话术，先肯定其中合理部分，再指出可以优化的地方，最后给出更自然、更可信的表达。"
    );
  }

  return basePrompt.join("\n");
}

function createUserPrompt(args: {
  category: SalesLearningCategory;
  question: string;
  context: string;
}) {
  return [
    `用户问题：${args.question}`,
    "",
    "服务端内部知识上下文（只供你理解和归纳，不能直接展示原文）：",
    args.context.trim() || "无可用内部上下文。",
    "",
    "请基于以上信息回答用户。不要暴露知识库原文和检索细节。",
  ].join("\n");
}

export async function askDeepSeekSalesCoach(args: {
  category: SalesLearningCategory;
  question: string;
  context: string;
}) {
  const apiKey = getApiKey();
  if (!apiKey) return fallbackByCategory[args.category];

  const messages: DeepSeekMessage[] = [
    { role: "system", content: createSystemPrompt(args.category) },
    { role: "user", content: createUserPrompt(args) },
  ];

  try {
    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.DEEPSEEK_MODEL?.trim() || "deepseek-chat",
        messages,
        temperature: 0.4,
        max_tokens: 900,
      }),
    });

    const data = (await response.json().catch(() => ({}))) as DeepSeekChatResponse;
    if (!response.ok) {
      console.error("DeepSeek API request failed", response.status, data.error?.message || response.statusText);
      return fallbackByCategory[args.category];
    }

    const content = data.choices?.[0]?.message?.content?.trim();
    return content || fallbackByCategory[args.category];
  } catch (error) {
    console.error("DeepSeek API request error", error);
    return fallbackByCategory[args.category];
  }
}
