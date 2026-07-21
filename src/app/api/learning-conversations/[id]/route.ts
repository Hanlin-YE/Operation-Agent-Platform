import { NextResponse } from "next/server";
import { deleteLearningConversation, renameLearningConversation } from "@/server/repositories/learningConversations";

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const body = await request.json().catch(() => ({}));
  if (typeof body.title !== "string" || !body.title.trim()) return NextResponse.json({ error: "title is required" }, { status: 400 });
  const conversation = await renameLearningConversation(params.id, body.title);
  return conversation ? NextResponse.json(conversation) : NextResponse.json({ error: "conversation not found" }, { status: 404 });
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const deleted = await deleteLearningConversation(params.id);
  return deleted ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "conversation not found" }, { status: 404 });
}
