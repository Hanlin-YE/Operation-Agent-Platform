import { LearningCategory, LearningConversation } from "@/server/data/types";
import { makeId, readData, writeData } from "@/server/data/store";

export function buildSimulatedCustomerImportPrompt(input: { companyName: string; companyUrl: string }) {
  return [
    `根据该企业信息（企业链接：${input.companyUrl}），请分析并蒸馏该企业的企业画像。`,
    "需要包括：",
    "1. 企业基本信息；",
    "2. 企业主营业务；",
    "3. 核心产品与技术方向；",
    "4. 业务需求与潜在痛点；",
    "5. 可能的采购需求；",
    "6. 企业决策关注点；",
    "7. 适合的销售沟通策略。",
    "请基于以上信息，模拟该企业作为客户，与销售人员进行真实业务交流。语气刁钻直击痛点。",
  ].join("\n");
}

function normalizeLearningCategory(category: unknown): LearningCategory {
  return category === "script" || category === "customer" ? category : "product";
}

function defaultLearningTitle(category: LearningCategory) {
  return category === "customer" ? "新的模拟客户对话" : "新的销售培训对话";
}

export async function listLearningConversations() {
  const data = await readData();
  return [...(data.learningConversations || [])]
    .map((item) => ({ ...item, category: normalizeLearningCategory(item.category) }))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function createLearningConversation(category: LearningCategory = "product") {
  const data = await readData(); const now = new Date().toISOString();
  const normalizedCategory = normalizeLearningCategory(category);
  const item: LearningConversation = { id: makeId("learning"), title: defaultLearningTitle(normalizedCategory), category: normalizedCategory, messages: [], createdAt: now, updatedAt: now };
  data.learningConversations = [item, ...(data.learningConversations || [])];
  await writeData(data); return item;
}

export async function createSimulatedCustomerConversation(input: { companyName: string; companyUrl: string }) {
  const data = await readData(); const now = new Date().toISOString();
  const prompt = buildSimulatedCustomerImportPrompt(input);
  const item: LearningConversation = {
    id: makeId("learning"),
    title: input.companyName.trim().slice(0, 40) || "模拟客户",
    category: "customer",
    targetCompanyName: input.companyName.trim(),
    targetCompanyUrl: input.companyUrl.trim(),
    targetCompanyPrompt: prompt,
    messages: [],
    createdAt: now,
    updatedAt: now,
  };
  data.learningConversations = [item, ...(data.learningConversations || [])];
  await writeData(data); return item;
}

export async function renameLearningConversation(id: string, title: string) {
  const data = await readData(); const conversation = (data.learningConversations || []).find((item) => item.id === id);
  if (!conversation) return null;
  conversation.title = title.trim().slice(0, 40) || "新的学习对话";
  conversation.updatedAt = new Date().toISOString();
  await writeData(data); return conversation;
}

export async function deleteLearningConversation(id: string) {
  const data = await readData();
  const conversations = data.learningConversations || [];
  const exists = conversations.some((item) => item.id === id);
  if (!exists) return false;
  data.learningConversations = conversations.filter((item) => item.id !== id);
  await writeData(data); return true;
}

export async function appendLearningMessages(id: string, messages: LearningConversation["messages"]) {
  const data = await readData(); const conversation = (data.learningConversations || []).find((item) => item.id === id);
  if (!conversation) return null;
  conversation.messages.push(...messages); conversation.updatedAt = new Date().toISOString();
  if (["新的学习对话", "新的销售培训对话", "新的模拟客户对话"].includes(conversation.title) && messages[0]?.content) conversation.title = messages[0].content.slice(0, 24);
  await writeData(data); return conversation;
}
