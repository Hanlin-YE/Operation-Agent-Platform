import { NextResponse } from "next/server";
import { PitchComplianceError } from "@/lib/sales/pitchCompliance";
import { followUpDate } from "@/lib/sales/dailyWork";
import { readData } from "@/server/data/store";
import { getLead } from "@/server/repositories/leads";
import { saveFollowUp, updateFollowUpStatus } from "@/server/repositories/salesArtifacts";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body.leadId !== "string" || typeof body.content !== "string" || !body.content.trim()) {
    return NextResponse.json({ error: "请填写线索和跟进内容。" }, { status: 400 });
  }
  if (!await getLead(body.leadId)) return NextResponse.json({ error: "找不到这条线索。" }, { status: 404 });
  if (body.type && !["call", "wechat", "email", "meeting", "note"].includes(body.type)) return NextResponse.json({ error: "跟进方式无效。" }, { status: 400 });
  if (body.nextActionAt && (typeof body.nextActionAt !== "string" || !Number.isFinite(followUpDate(body.nextActionAt).getTime()))) return NextResponse.json({ error: "跟进时间无效。" }, { status: 400 });
  if (body.pitchId) {
    const data = await readData();
    if (!data.pitches.some((pitch) => pitch.id === body.pitchId && pitch.leadId === body.leadId)) return NextResponse.json({ error: "话术不属于这条线索。" }, { status: 400 });
  }
  try {
    const followUp = await saveFollowUp({
      leadId: body.leadId, pitchId: body.pitchId, type: body.type || "note", content: body.content.trim(),
      nextActionAt: body.nextActionAt ? followUpDate(body.nextActionAt).toISOString() : undefined, status: "open"
    });
    return NextResponse.json(followUp, { status: 201 });
  } catch (error) {
    if (error instanceof PitchComplianceError) return NextResponse.json({ error: error.message, issues: error.issues }, { status: 422 });
    throw error;
  }
}

export async function PATCH(request: Request) {
  const body = await request.json().catch(() => ({}));
  if (typeof body.id !== "string" || !["open", "done"].includes(body.status)) return NextResponse.json({ error: "id and a valid status are required" }, { status: 400 });
  const followUp = await updateFollowUpStatus(body.id, body.status);
  return followUp ? NextResponse.json(followUp) : NextResponse.json({ error: "follow-up not found" }, { status: 404 });
}
