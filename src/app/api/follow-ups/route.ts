import { NextResponse } from "next/server";
import { saveFollowUp, updateFollowUpStatus } from "@/server/repositories/salesArtifacts";

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

export async function PATCH(request: Request) {
  const body = await request.json().catch(() => ({}));
  if (typeof body.id !== "string" || !["open", "done"].includes(body.status)) {
    return NextResponse.json({ error: "id and a valid status are required" }, { status: 400 });
  }
  const followUp = await updateFollowUpStatus(body.id, body.status);
  return followUp ? NextResponse.json(followUp) : NextResponse.json({ error: "follow-up not found" }, { status: 404 });
}
