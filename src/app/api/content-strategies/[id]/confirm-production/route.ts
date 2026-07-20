import { NextResponse } from "next/server";
import { getContentStrategy, isLatestContentStrategy, updateContentStrategy } from "@/server/repositories/contentStrategies";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const strategy = await getContentStrategy(params.id);
  if (!strategy) return NextResponse.json({ error: "未找到内容策略包。" }, { status: 404 });
  if (!await isLatestContentStrategy(params.id)) return NextResponse.json({ error: "旧版本不能确认生产。" }, { status: 409 });
  if (strategy.status !== "approved" || !strategy.analysis) return NextResponse.json({ error: "只有当前且审核通过的策略包可以确认进入生产。" }, { status: 409 });
  const body = await request.json().catch(() => ({}));
  const updated = await updateContentStrategy(params.id, { productionConfirmation: { operator: typeof body.operator === "string" && body.operator.trim() ? body.operator.trim() : "当前运营人员", confirmedAt: new Date().toISOString() } });
  return NextResponse.json(updated);
}
