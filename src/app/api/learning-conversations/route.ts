import { NextResponse } from "next/server";
import { LearningCategory } from "@/server/data/types";
import { createLearningConversation, listLearningConversations } from "@/server/repositories/learningConversations";

const categories: LearningCategory[] = ["product", "market", "script"];

export async function GET() { return NextResponse.json(await listLearningConversations()); }
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const category = categories.includes(body.category) ? body.category : "product";
  return NextResponse.json(await createLearningConversation(category), { status: 201 });
}
