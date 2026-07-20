import { NextResponse } from "next/server";
import { requestContentStrategyRework, retryContentStrategyRework } from "@/server/contentStrategy/service";
import { getContentStrategy, getContentStrategyVersions, isLatestContentStrategy } from "@/server/repositories/contentStrategies";

const stages = new Set(["strategy_review", "production_confirmation", "production_draft"]);
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const item = await getContentStrategy(params.id); if (!item) return NextResponse.json({ error: "未找到内容策略包。" }, { status: 404 });
  if (!await isLatestContentStrategy(params.id)) return NextResponse.json({ error: "旧版本不能再次提交返修。" }, { status: 409 });
  const body = await request.json();
  if (!stages.has(body.stage) || typeof body.reason !== "string" || !body.reason.trim()) return NextResponse.json({ error: "请填写返工意见并选择返工阶段。" }, { status: 422 });
  if (item.status === "rework_processing") return NextResponse.json({ error: "返修正在处理中，请勿重复提交。" }, { status: 409 });
  const versions = await getContentStrategyVersions(item.id); const previous = versions.at(-2)?.analysis;
  const next = ["rework_pending", "rework_failed"].includes(item.status) ? await retryContentStrategyRework(item, previous) : await requestContentStrategyRework(item, { operator: typeof body.operator === "string" ? body.operator : "当前运营人员", stage: body.stage, reason: body.reason });
  return NextResponse.json(next, { status: 201 });
}
