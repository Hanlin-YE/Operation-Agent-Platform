import { NextResponse } from "next/server";
import { runLeadScoringAgent } from "@/server/agents/leadScoringAgent";

export async function POST(request: Request) {
  const body = await request.json();
  if (!body.leadId) {
    return NextResponse.json({ error: "leadId is required" }, { status: 400 });
  }

  const score = await runLeadScoringAgent(body.leadId);
  return NextResponse.json(score);
}
