import assert from "node:assert/strict";
import test from "node:test";
import { chunkKnowledgeText, embedKnowledgeText, rankKnowledgeChunks } from "@/server/rag/salesVectorIndex";

test("sales RAG splits PDF pages into cited chunks", () => {
  const chunks = chunkKnowledgeText("第一页内容包含无刷电机。\f第二页内容包含医疗泵。", "knowledge-1", "产品手册");

  assert.equal(chunks.length, 2);
  assert.deepEqual(chunks.map((chunk) => chunk.pageNumber), [1, 2]);
  assert.equal(chunks[1].sourceTitle, "产品手册");
});

test("sales RAG ranks a matching vector chunk ahead of unrelated content", () => {
  const chunks = [
    { id: "a", knowledgeId: "a", sourceTitle: "产品 A", pageNumber: 1, text: "无刷电机适用于医疗泵，低噪音。", embedding: embedKnowledgeText("无刷电机适用于医疗泵，低噪音。") },
    { id: "b", knowledgeId: "b", sourceTitle: "产品 B", pageNumber: 1, text: "工业风扇安装说明。", embedding: embedKnowledgeText("工业风扇安装说明。") },
  ];

  assert.equal(rankKnowledgeChunks("医疗泵无刷电机", chunks, 1)[0].knowledgeId, "a");
});
