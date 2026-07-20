import { NextResponse } from "next/server";
import { makeId } from "@/server/data/store";
import { listKnowledge } from "@/server/repositories/knowledge";
import { appendLearningMessages } from "@/server/repositories/learningConversations";
import { answerSalesLearningQuestion } from "@/server/learning/answerSalesLearningQuestion";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const body = await request.json().catch(() => ({}));
  if (typeof body.content !== "string" || !body.content.trim()) return NextResponse.json({ error: "content is required" }, { status: 400 });
  const now = new Date().toISOString(); const knowledge = await listKnowledge();
  const learner = { id: makeId("message"), role: "learner" as const, content: body.content.trim(), createdAt: now };
  const coach = { id: makeId("message"), role: "coach" as const, content: answerSalesLearningQuestion(learner.content, knowledge), createdAt: now };
  const conversation = await appendLearningMessages(params.id, [learner, coach]);
  return conversation ? NextResponse.json(conversation) : NextResponse.json({ error: "conversation not found" }, { status: 404 });
}
