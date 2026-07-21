import { LearningCategory, LearningConversation } from "@/server/data/types";
import { makeId, readData, writeData } from "@/server/data/store";

export async function listLearningConversations() {
  const data = await readData();
  return [...(data.learningConversations || [])].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function createLearningConversation(category: LearningCategory = "product") {
  const data = await readData(); const now = new Date().toISOString();
  const item: LearningConversation = { id: makeId("learning"), title: "新的学习对话", category, messages: [], createdAt: now, updatedAt: now };
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
  if (conversation.title === "新的学习对话" && messages[0]?.content) conversation.title = messages[0].content.slice(0, 24);
  await writeData(data); return conversation;
}

export async function setLearningConversationPersona(id: string, persona: { id: string; companyName: string }) {
  const data = await readData(); const conversation = (data.learningConversations || []).find((item) => item.id === id);
  if (!conversation) return null;
  conversation.targetCompanyPersonaId = persona.id;
  conversation.targetCompanyName = persona.companyName;
  if (conversation.category === "market" && conversation.title === "新的学习对话") conversation.title = persona.companyName.slice(0, 24);
  conversation.updatedAt = new Date().toISOString();
  await writeData(data); return conversation;
}
