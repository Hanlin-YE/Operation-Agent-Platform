import { LearningConversation } from "@/server/data/types";
import { makeId, readData, writeData } from "@/server/data/store";

export async function listLearningConversations() {
  const data = await readData();
  return [...(data.learningConversations || [])].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function createLearningConversation() {
  const data = await readData(); const now = new Date().toISOString();
  const item: LearningConversation = { id: makeId("learning"), title: "新的学习对话", messages: [], createdAt: now, updatedAt: now };
  data.learningConversations = [item, ...(data.learningConversations || [])];
  await writeData(data); return item;
}

export async function appendLearningMessages(id: string, messages: LearningConversation["messages"]) {
  const data = await readData(); const conversation = (data.learningConversations || []).find((item) => item.id === id);
  if (!conversation) return null;
  conversation.messages.push(...messages); conversation.updatedAt = new Date().toISOString();
  if (conversation.title === "新的学习对话" && messages[0]?.content) conversation.title = messages[0].content.slice(0, 24);
  await writeData(data); return conversation;
}
