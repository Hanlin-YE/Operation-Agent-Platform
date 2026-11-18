import { NextResponse } from "next/server";
import { updateLead } from "@/server/repositories/leads";
import { parseLeadPatch } from "@/lib/sales/leadInput";

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "线索数据格式无效。" }, { status: 400 });
  let patch;
  try { patch = parseLeadPatch(body); }
  catch (error) { return NextResponse.json({ error: (error as Error).message }, { status: 400 }); }
  const lead = await updateLead(params.id, patch);
  return lead ? NextResponse.json(lead) : NextResponse.json({ error: "找不到这条线索。" }, { status: 404 });
}
