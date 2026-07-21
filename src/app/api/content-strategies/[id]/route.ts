import { NextResponse } from "next/server";
import { getContentStrategy, isLatestContentStrategy, updateContentStrategy } from "@/server/repositories/contentStrategies";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const item = await getContentStrategy(params.id);
  return item ? NextResponse.json(item) : NextResponse.json({ error: "未找到内容策略包。" }, { status: 404 });
}
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const body = await request.json();
  if (body.status !== "approved") return NextResponse.json({ error: "拒绝请使用带返修需求的打回重做入口。" }, { status: 422 });
  if (!await isLatestContentStrategy(params.id)) return NextResponse.json({ error: "只有最新版本可以审核。" }, { status: 409 });
  const updated = await updateContentStrategy(params.id, { status: body.status, review: { operator: String(body.operator || "运营人员"), note: typeof body.note === "string" ? body.note : undefined, reviewedAt: new Date().toISOString() } });
  return updated ? NextResponse.json(updated) : NextResponse.json({ error: "未找到内容策略包。" }, { status: 404 });
}
