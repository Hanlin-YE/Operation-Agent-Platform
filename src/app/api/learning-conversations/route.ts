import { NextResponse } from "next/server";
import { LearningCategory } from "@/server/data/types";
import { createLearningConversation, createSimulatedCustomerConversation, listLearningConversations } from "@/server/repositories/learningConversations";

const categories: LearningCategory[] = ["product", "script", "customer"];

export async function GET() { return NextResponse.json(await listLearningConversations()); }
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  if (body.importSource === "market-intelligence" && body.category === "customer") {
    if (typeof body.companyName !== "string" || !body.companyName.trim() || typeof body.companyUrl !== "string" || !body.companyUrl.trim()) {
      return NextResponse.json({ error: "companyName and companyUrl are required" }, { status: 400 });
    }
    return NextResponse.json(await createSimulatedCustomerConversation({ companyName: body.companyName, companyUrl: body.companyUrl }), { status: 201 });
  }
  const category = categories.includes(body.category) ? body.category : "product";
  return NextResponse.json(await createLearningConversation(category), { status: 201 });
}
