import { NextResponse } from "next/server";
import { createLearningConversation, listLearningConversations } from "@/server/repositories/learningConversations";

export async function GET() { return NextResponse.json(await listLearningConversations()); }
export async function POST() { return NextResponse.json(await createLearningConversation(), { status: 201 }); }
