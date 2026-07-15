import { KnowledgeDocument } from "@/server/data/types";
import { makeId, readData, writeData } from "@/server/data/store";

export type KnowledgeInput = Omit<KnowledgeDocument, "id" | "createdAt" | "updatedAt">;

export async function listKnowledge() {
  const data = await readData();
  return data.knowledge.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function createKnowledge(input: Partial<KnowledgeInput>) {
  const data = await readData();
  const now = new Date().toISOString();
  const item: KnowledgeDocument = {
    id: makeId("knowledge"),
    title: input.title?.trim() || "未命名知识",
    type: input.type || "faq",
    content: input.content?.trim() || "",
    sourceFile: input.sourceFile,
    createdAt: now,
    updatedAt: now
  };
  data.knowledge.unshift(item);
  await writeData(data);
  return item;
}
