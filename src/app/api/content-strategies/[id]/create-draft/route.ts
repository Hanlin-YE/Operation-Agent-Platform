import { NextResponse } from "next/server";
import { getContentStrategy, isLatestContentStrategy, updateContentStrategy } from "@/server/repositories/contentStrategies";

export async function POST(_: Request, { params }: { params: { id: string } }) {
  const item = await getContentStrategy(params.id);
  if (!item) return NextResponse.json({ error: "未找到内容策略包。" }, { status: 404 });
  if (!await isLatestContentStrategy(params.id)) return NextResponse.json({ error: "旧版本不能创建生产草稿。" }, { status: 409 });
  if (item.status !== "approved" || !item.analysis) return NextResponse.json({ error: "当前策略包审核通过后才能交接生产。" }, { status: 409 });
  if (!item.productionConfirmation) return NextResponse.json({ error: "请由运营人员确认策略后再进入生产。" }, { status: 409 });
  await updateContentStrategy(item.id, { productionDraft: { createdAt: new Date().toISOString() } });
  return NextResponse.json({ strategyId: item.id, status: "draft_ready", message: "已准备生产草稿上下文；请选择目标平台继续创作，不会自动发布。", recommendations: item.analysis.recommendations });
}
