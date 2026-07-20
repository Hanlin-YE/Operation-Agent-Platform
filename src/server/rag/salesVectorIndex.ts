import { KnowledgeDocument, KnowledgeVectorChunk } from "@/server/data/types";
import { readData, writeData } from "@/server/data/store";

export const SALES_EMBEDDING_MODEL = "hashing-cjk-v1";
export const SALES_EMBEDDING_DIMENSIONS = 256;
const chunkLength = 700;
const chunkOverlap = 120;

function hashToken(token: string) {
  let value = 2166136261;
  for (let index = 0; index < token.length; index += 1) {
    value ^= token.charCodeAt(index);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}

function tokens(text: string) {
  const words = text.toLowerCase().match(/[a-z0-9]{2,}|[\u4e00-\u9fff]/g) || [];
  const pairs = Array.from(text.replace(/\s/g, "")).flatMap((_, index, chars) => index < chars.length - 1 ? [chars.slice(index, index + 2).join("")] : []);
  return [...words, ...pairs];
}

export function embedKnowledgeText(text: string) {
  const vector = new Array<number>(SALES_EMBEDDING_DIMENSIONS).fill(0);
  for (const token of tokens(text)) {
    const hash = hashToken(token);
    vector[hash % SALES_EMBEDDING_DIMENSIONS] += hash & 1 ? 1 : -1;
  }
  const norm = Math.hypot(...vector) || 1;
  return vector.map((value) => Number((value / norm).toFixed(8)));
}

function cosine(left: number[], right: number[]) {
  return left.reduce((sum, value, index) => sum + value * (right[index] || 0), 0);
}

export function chunkKnowledgeText(text: string, knowledgeId: string, sourceTitle: string): KnowledgeVectorChunk[] {
  const pages = text.split("\f").map((page) => page.trim()).filter(Boolean);
  const sourcePages = pages.length ? pages : [text.trim()];
  return sourcePages.flatMap((page, pageIndex) => {
    const chunks: KnowledgeVectorChunk[] = [];
    for (let start = 0, chunkIndex = 0; start < page.length; start += chunkLength - chunkOverlap, chunkIndex += 1) {
      const fragment = page.slice(start, start + chunkLength).trim();
      if (!fragment) continue;
      chunks.push({
        id: `${knowledgeId}:${pageIndex + 1}:${chunkIndex + 1}`,
        knowledgeId,
        sourceTitle,
        pageNumber: pageIndex + 1,
        text: fragment,
        embedding: embedKnowledgeText(fragment),
      });
      if (start + chunkLength >= page.length) break;
    }
    return chunks;
  });
}

export function rankKnowledgeChunks(query: string, chunks: KnowledgeVectorChunk[], limit = 6) {
  const queryEmbedding = embedKnowledgeText(query);
  return chunks
    .map((chunk) => ({ ...chunk, score: cosine(queryEmbedding, chunk.embedding) }))
    .filter((chunk) => chunk.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, limit);
}

export async function indexKnowledgeDocument(knowledge: KnowledgeDocument) {
  const data = await readData();
  data.knowledgeChunks = [
    ...(data.knowledgeChunks || []).filter((chunk) => chunk.knowledgeId !== knowledge.id),
    ...chunkKnowledgeText(knowledge.content, knowledge.id, knowledge.title),
  ];
  await writeData(data);
  return data.knowledgeChunks.filter((chunk) => chunk.knowledgeId === knowledge.id);
}

export async function removeKnowledgeDocumentFromIndex(knowledgeId: string) {
  const data = await readData();
  data.knowledgeChunks = (data.knowledgeChunks || []).filter((chunk) => chunk.knowledgeId !== knowledgeId);
  await writeData(data);
}

export async function searchSalesKnowledge(query: string, limit = 6) {
  const data = await readData();
  if (!data.knowledgeChunks?.length && data.knowledge.length) {
    data.knowledgeChunks = data.knowledge.flatMap((knowledge) => chunkKnowledgeText(knowledge.content, knowledge.id, knowledge.title));
    await writeData(data);
  }
  return rankKnowledgeChunks(query, data.knowledgeChunks || [], limit);
}

export async function getSalesRagStatus() {
  const data = await readData();
  return { embeddingModel: SALES_EMBEDDING_MODEL, dimensions: SALES_EMBEDDING_DIMENSIONS, chunkCount: data.knowledgeChunks?.length || 0 };
}
