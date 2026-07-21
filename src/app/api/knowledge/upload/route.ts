import { NextResponse } from "next/server";
import { parseKnowledgePdfUpload } from "@/server/knowledge/pdfUpload";
import { createKnowledge, updateKnowledge } from "@/server/repositories/knowledge";
import { ingestProductTextToRag } from "@/server/rag/ragClient";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const form = await request.formData();
  const file = form.get("file");
  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "请选择一个 PDF 文件。" }, { status: 400 });
  }

  try {
    const parsed = await parseKnowledgePdfUpload(file);
    const item = await createKnowledge({
      title: parsed.title,
      content: parsed.content,
      sourceFile: parsed.sourceFile,
      type: "product",
    });
    const ragDocument = await ingestProductTextToRag({
      title: item.title,
      text: item.content,
      sourceFile: item.sourceFile,
      knowledgeId: item.id,
    });
    const syncedItem = ragDocument
      ? await updateKnowledge(item.id, {
          ragDocumentId: ragDocument.id,
          ragReviewStatus: ragDocument.review_status,
          ragIngestedAt: ragDocument.reviewed_at || new Date().toISOString(),
        })
      : item;
    return NextResponse.json({ item: syncedItem || item, pageCount: parsed.pageCount }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "PDF 解析失败，请稍后重试。";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
