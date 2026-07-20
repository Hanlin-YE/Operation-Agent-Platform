import { NextResponse } from "next/server";
import { updatePitchContent } from "@/server/repositories/salesArtifacts";

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const body = await request.json().catch(() => ({}));
  if (typeof body.content !== "string" || !body.content.trim()) {
    return NextResponse.json({ error: "content is required" }, { status: 400 });
  }
  const pitch = await updatePitchContent(params.id, body.content);
  return pitch ? NextResponse.json(pitch) : NextResponse.json({ error: "pitch not found" }, { status: 404 });
}
