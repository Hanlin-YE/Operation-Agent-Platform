import { NextResponse } from "next/server";
import { recommendProductForLead } from "@/server/agents/productRecommendationAgent";

export async function POST(request: Request) {
  const { leadId } = await request.json();
  if (!leadId) return NextResponse.json({ error: "leadId is required" }, { status: 400 });
  try { return NextResponse.json(await recommendProductForLead(leadId)); }
  catch { return NextResponse.json({ error: "lead not found" }, { status: 404 }); }
}
