import { NextResponse } from "next/server";
import { PitchChannel } from "@/server/data/types";
import { runPitchGenerationAgent } from "@/server/agents/pitchGenerationAgent";

const channels: PitchChannel[] = ["phone", "wechat", "email", "quote_followup", "price_objection", "technical_confirm"];

export async function POST(request: Request) {
  const body = await request.json();
  if (!body.leadId || !channels.includes(body.channel)) {
    return NextResponse.json({ error: "leadId and valid channel are required" }, { status: 400 });
  }

  const pitch = await runPitchGenerationAgent(body.leadId, body.channel);
  return NextResponse.json(pitch);
}
