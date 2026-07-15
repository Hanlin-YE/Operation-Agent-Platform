import { NextResponse } from "next/server";
import { createLead, listLeads } from "@/server/repositories/leads";

export async function GET() {
  return NextResponse.json(await listLeads());
}

export async function POST(request: Request) {
  const body = await request.json();
  const lead = await createLead({
    ...body,
    tags: typeof body.tags === "string" ? body.tags.split(/[,，、]/).map((tag: string) => tag.trim()).filter(Boolean) : body.tags
  });
  return NextResponse.json(lead, { status: 201 });
}
