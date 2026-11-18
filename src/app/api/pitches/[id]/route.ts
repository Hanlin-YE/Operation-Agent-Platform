import { PitchComplianceError } from "@/lib/sales/pitchCompliance";
import { NextResponse } from "next/server";
import { updatePitchContent } from "@/server/repositories/salesArtifacts";

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const body = await request.json().catch(() => ({}));
  if (!body || typeof body.content !== "string" || !body.content.trim()) {
    return NextResponse.json({ error: "content is required" }, { status: 400 });
  }
  try {
    const pitch = await updatePitchContent(params.id, body.content);
    return pitch ? NextResponse.json(pitch) : NextResponse.json({ error: "pitch not found" }, { status: 404 });
  } catch (error) {
    if (error instanceof PitchComplianceError) return NextResponse.json({ error: error.message, issues: error.issues }, { status: 422 });
    throw error;
  }
}
