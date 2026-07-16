import { NextResponse } from "next/server";
import { analyzeMarket } from "@/server/agents/marketAnalysisAgent";
import { MarketFocus } from "@/server/data/types";

const allowedFocuses: MarketFocus[] = ["all", "robotics", "medical", "industrial", "automotive", "aerospace"];

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const focus = allowedFocuses.includes(body.focus) ? body.focus : "all";
  return NextResponse.json(await analyzeMarket(focus));
}
