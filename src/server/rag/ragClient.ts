import { approveDemoDocument, ingestDemoText, searchDemoRag } from "@/server/rag/demoService";
import { readData } from "@/server/data/store";
import type { RagSearchHit } from "@/server/learning/answerSalesLearningQuestion";

type IngestProductTextArgs = {
  title: string;
  text: string;
  sourceFile?: string;
  knowledgeId?: string;
};

const productDocumentType = "product";
const knowledgeReviewerId = "knowledge-workspace";

export async function ingestProductTextToRag(args: IngestProductTextArgs) {
  const text = args.text.trim();
  if (!text) return null;

  const document = await ingestDemoText({
    title: args.title,
    text,
    documentType: productDocumentType,
    metadata: {
      ingestion_channel: "knowledge_page",
      source_scope: "sales_training",
      source_file: args.sourceFile,
      knowledge_id: args.knowledgeId,
    },
  });

  return approveRagDocument(document.id);
}

export async function approveRagDocument(documentId: string) {
  return approveDemoDocument(documentId, knowledgeReviewerId);
}

export async function searchProductRag(query: string, limit = 5): Promise<RagSearchHit[]> {
  const data = await readData();
  const allowedDocumentIds = new Set(
    data.knowledge
      .filter((item) => item.type === "product" && item.ragReviewStatus === "approved" && item.ragDocumentId)
      .map((item) => item.ragDocumentId!)
  );
  if (!allowedDocumentIds.size) return [];

  const hits = await searchDemoRag(query, Math.max(limit * 4, 12), productDocumentType);
  return hits.filter((hit) => allowedDocumentIds.has(hit.citation.document_id)).slice(0, limit);
}
