import { NextResponse } from "next/server";
import { getLead } from "@/server/repositories/leads";
import { recommendProductForLead } from "@/server/agents/productRecommendationAgent";
import { selectStrategy } from "@/server/persuasion/strategyLibrary";

export async function POST(request: Request) {
  const { leadId, message } = await request.json();
  const lead = await getLead(leadId);
  if (!lead || !message) return NextResponse.json({ error: "leadId and message are required" }, { status: 400 });
  const strategy = selectStrategy(message);
  if (lead.accountTier === "KA") return NextResponse.json({ reply: "已收到您的需求，专属客户经理将尽快联系。", strategy, action: "HANDOFF_TO_HUMAN" });
  if (lead.accountTier === "LA" && strategy.id === "human_handoff") return NextResponse.json({ reply: "该问题需要技术或商务同事审核后回复。", strategy, action: "REQUIRE_HUMAN_APPROVAL" });
  const recommendation = await recommendProductForLead(leadId);
  return NextResponse.json({ reply: `可先了解 ${recommendation.product.name}。${recommendation.questions[0]} 具体参数需按项目选型确认。`, strategy, action: "NURTURE_RESPONSE", videoKey: "product-introduction-pending-review" });
}
