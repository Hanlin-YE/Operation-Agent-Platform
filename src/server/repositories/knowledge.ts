import { KnowledgeDocument } from "@/server/data/types";
import { makeId, readData, writeData } from "@/server/data/store";

export type KnowledgeInput = Omit<KnowledgeDocument, "id" | "createdAt" | "updatedAt">;
const knowledgeTypes: KnowledgeDocument["type"][] = ["product", "case", "objection", "selection", "faq"];

export function isKnowledgeType(value: unknown): value is KnowledgeDocument["type"] {
  return typeof value === "string" && knowledgeTypes.includes(value as KnowledgeDocument["type"]);
}

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
    storagePath: input.storagePath,
    createdAt: now,
    updatedAt: now
  };
  data.knowledge.unshift(item);
  await writeData(data);
  return item;
}

export async function updateKnowledge(id: string, input: Partial<KnowledgeInput>) {
  const data = await readData();
  const item = data.knowledge.find((knowledge) => knowledge.id === id);
  if (!item) return null;
  if (typeof input.title === "string") item.title = input.title.trim() || item.title;
  if (typeof input.content === "string") item.content = input.content.trim();
  if (isKnowledgeType(input.type)) item.type = input.type;
  if (typeof input.sourceFile === "string") item.sourceFile = input.sourceFile.trim() || undefined;
  if (typeof input.ragDocumentId === "string") item.ragDocumentId = input.ragDocumentId.trim() || undefined;
  if (input.ragReviewStatus === "pending" || input.ragReviewStatus === "approved" || input.ragReviewStatus === "rejected") item.ragReviewStatus = input.ragReviewStatus;
  if (typeof input.ragIngestedAt === "string") item.ragIngestedAt = input.ragIngestedAt.trim() || undefined;
  item.updatedAt = new Date().toISOString();
  await writeData(data);
  return item;
}

export async function deleteKnowledge(id: string) {
  const data = await readData();
  const index = data.knowledge.findIndex((knowledge) => knowledge.id === id);
  if (index < 0) return false;
  data.knowledge.splice(index, 1);
  await writeData(data);
  return true;
}
