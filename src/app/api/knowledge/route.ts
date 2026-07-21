import { NextResponse } from "next/server";
import { createKnowledge, deleteKnowledge, isKnowledgeType, listKnowledge, updateKnowledge } from "@/server/repositories/knowledge";
import { ingestProductTextToRag } from "@/server/rag/ragClient";

export async function GET() {
  return NextResponse.json(await listKnowledge());
}

export async function POST(request: Request) {
  const body = await request.json();
  const item = await createKnowledge(body);
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
  return NextResponse.json(syncedItem || item, { status: 201 });
}

export async function PATCH(request: Request) {
  const body = await request.json().catch(() => ({}));
  if (typeof body.id !== "string" || (body.type !== undefined && !isKnowledgeType(body.type))) {
    return NextResponse.json({ error: "id and a valid knowledge type are required" }, { status: 400 });
  }
  const item = await updateKnowledge(body.id, body);
  return item ? NextResponse.json(item) : NextResponse.json({ error: "knowledge not found" }, { status: 404 });
}

export async function DELETE(request: Request) {
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
  return await deleteKnowledge(id) ? new NextResponse(null, { status: 204 }) : NextResponse.json({ error: "knowledge not found" }, { status: 404 });
}
