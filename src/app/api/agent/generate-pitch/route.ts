import { PitchComplianceError } from "@/lib/sales/pitchCompliance";
import { NextResponse } from "next/server";
import { getLead } from "@/server/repositories/leads";
import { PitchChannel } from "@/server/data/types";
import { runPitchGenerationAgent } from "@/server/agents/pitchGenerationAgent";

const channels: PitchChannel[] = ["phone", "wechat", "email", "quote_followup", "price_objection", "technical_confirm"];

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body.leadId !== "string" || !channels.includes(body.channel)) {
    return NextResponse.json({ error: "leadId and valid channel are required" }, { status: 400 });
  }

  if (!await getLead(body.leadId)) return NextResponse.json({ error: "找不到这条线索。" }, { status: 404 });
  try {
    const pitch = await runPitchGenerationAgent(body.leadId, body.channel);
    return NextResponse.json(pitch);
  } catch (error) {
    if (error instanceof PitchComplianceError) return NextResponse.json({ error: error.message, issues: error.issues }, { status: 422 });
    return NextResponse.json({ error: "话术生成失败，请稍后重试。" }, { status: 503 });
  }
}
