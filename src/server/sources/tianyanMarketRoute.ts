import { NextResponse } from "next/server";
import { TianyanAiSource, TianyanCompanyCandidate, TianyanMarketProfile } from "@/server/sources/tianyanAi";

type TianyanMarketSource = {
  searchCompanies(query: string): Promise<TianyanCompanyCandidate[]>;
  getMarketProfile(companyName: string): Promise<TianyanMarketProfile>;
};

export function createTianyanMarketPostHandler(source: TianyanMarketSource = new TianyanAiSource()) {
  return async function POST(request: Request) {
    const body = await request.json().catch(() => null) as { action?: unknown; query?: unknown; companyName?: unknown } | null;
    if (!body || typeof body.action !== "string") return NextResponse.json({ error: "invalid_body" }, { status: 400 });

    try {
      if (body.action === "search") {
        if (typeof body.query !== "string") return NextResponse.json({ error: "query_required" }, { status: 400 });
        return NextResponse.json({ action: "search", candidates: await source.searchCompanies(body.query) });
      }
      if (body.action === "profile") {
        if (typeof body.companyName !== "string") return NextResponse.json({ error: "company_name_required" }, { status: 400 });
        return NextResponse.json({ action: "profile", profile: await source.getMarketProfile(body.companyName) });
      }
      return NextResponse.json({ error: "unsupported_action" }, { status: 400 });
    } catch (error) {
      return NextResponse.json({ error: "tianyan_unavailable", message: error instanceof Error ? error.message : "天眼 AI 查询暂时不可用。" }, { status: 503 });
    }
  };
}
