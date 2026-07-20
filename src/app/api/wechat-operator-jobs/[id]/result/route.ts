import { NextResponse } from "next/server";
import { completeWechatOperatorJob } from "@/server/repositories/wechatOperatorJobs";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const expected = process.env.WECHAT_OPERATOR_TOKEN;
  if (!expected) return NextResponse.json({ error: "未配置 WECHAT_OPERATOR_TOKEN，拒绝采集机回传" }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${expected}`) return NextResponse.json({ error: "采集机身份校验失败" }, { status: 401 });
  try { return NextResponse.json(await completeWechatOperatorJob(params.id, await request.json())); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "回传失败" }, { status: 400 }); }
}
