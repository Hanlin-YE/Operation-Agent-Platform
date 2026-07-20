import { NextResponse } from "next/server";
import { createLead, listLeads, updateLeadStatus } from "@/server/repositories/leads";
import { LeadStatus } from "@/server/data/types";

const leadStatuses: LeadStatus[] = ["new", "to_follow", "contacted", "interested", "invalid", "deferred"];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const accountTier = searchParams.get("accountTier");
  return NextResponse.json(await listLeads({
    query: searchParams.get("query") || undefined,
    status: leadStatuses.includes(status as LeadStatus) ? status as LeadStatus : undefined,
    accountTier: ["KA", "LA", "SMB"].includes(accountTier || "") ? accountTier as "KA" | "LA" | "SMB" : undefined
  }));
}

export async function PATCH(request: Request) {
  const body = await request.json().catch(() => ({}));
  if (typeof body.id !== "string" || !leadStatuses.includes(body.status)) {
    return NextResponse.json({ error: "id and a valid status are required" }, { status: 400 });
  }
  const lead = await updateLeadStatus(body.id, body.status);
  return lead ? NextResponse.json(lead) : NextResponse.json({ error: "lead not found" }, { status: 404 });
}

export async function POST(request: Request) {
  const body = await request.json();
  const lead = await createLead({
    ...body,
    tags: typeof body.tags === "string" ? body.tags.split(/[,，、]/).map((tag: string) => tag.trim()).filter(Boolean) : body.tags
  });
  return NextResponse.json(lead, { status: 201 });
}
