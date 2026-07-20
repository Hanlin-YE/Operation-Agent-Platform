import { NextResponse } from "next/server";
import { getSalesRagStatus, searchSalesKnowledge } from "@/server/rag/salesVectorIndex";

export async function GET() {
  return NextResponse.json(await getSalesRagStatus());
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  if (typeof body.query !== "string" || !body.query.trim()) {
    return NextResponse.json({ error: "请输入检索问题。" }, { status: 400 });
  }
  const hits = await searchSalesKnowledge(body.query, typeof body.limit === "number" ? body.limit : 6);
  return NextResponse.json(hits.map((hit) => ({
    score: Number(hit.score.toFixed(4)), title: hit.sourceTitle, pageNumber: hit.pageNumber, text: hit.text,
  })));
}
