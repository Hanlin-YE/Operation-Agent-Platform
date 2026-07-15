import { NextResponse } from "next/server";
import { saveFollowUp } from "@/server/repositories/salesArtifacts";

export async function POST(request: Request) {
  const body = await request.json();
  if (!body.leadId || !body.content) {
    return NextResponse.json({ error: "leadId and content are required" }, { status: 400 });
  }

  const followUp = await saveFollowUp({
    leadId: body.leadId,
    pitchId: body.pitchId,
    type: body.type || "note",
    content: body.content,
    nextActionAt: body.nextActionAt,
    status: "open"
  });

  return NextResponse.json(followUp, { status: 201 });
}
