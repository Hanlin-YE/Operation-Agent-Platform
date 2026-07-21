import { NextResponse } from "next/server";
import { createKnowledge, deleteKnowledge, isKnowledgeType, listKnowledge, updateKnowledge } from "@/server/repositories/knowledge";
import { indexKnowledgeDocument, removeKnowledgeDocumentFromIndex } from "@/server/rag/salesVectorIndex";

export async function GET() {
  return NextResponse.json(await listKnowledge());
}

export async function POST(request: Request) {
  const body = await request.json();
  const item = await createKnowledge(body);
  await indexKnowledgeDocument(item);
  return NextResponse.json(item, { status: 201 });
}

export async function PATCH(request: Request) {
  const body = await request.json().catch(() => ({}));
  if (typeof body.id !== "string" || (body.type !== undefined && !isKnowledgeType(body.type))) {
    return NextResponse.json({ error: "id and a valid knowledge type are required" }, { status: 400 });
  }
  const item = await updateKnowledge(body.id, body);
  if (item) await indexKnowledgeDocument(item);
  return item ? NextResponse.json(item) : NextResponse.json({ error: "knowledge not found" }, { status: 404 });
}

export async function DELETE(request: Request) {
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
  const deleted = await deleteKnowledge(id);
  if (deleted) await removeKnowledgeDocumentFromIndex(id);
  return deleted ? new NextResponse(null, { status: 204 }) : NextResponse.json({ error: "knowledge not found" }, { status: 404 });
}
