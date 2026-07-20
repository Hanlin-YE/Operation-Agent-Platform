import { NextResponse } from "next/server";
import { createWechatOperatorJob, listWechatOperatorJobs } from "@/server/repositories/wechatOperatorJobs";

export async function GET() { return NextResponse.json(await listWechatOperatorJobs()); }
export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.articleQuery?.trim()) return NextResponse.json({ error: "请填写文章标题或唯一搜索词" }, { status: 400 });
    const job = await createWechatOperatorJob({ articleQuery: body.articleQuery, dateFrom: body.dateFrom || undefined, dateTo: body.dateTo || undefined, maxPages: Number(body.maxPages) || 1, requestedBy: "当前运营人员" });
    return NextResponse.json(job, { status: 201 });
  } catch { return NextResponse.json({ error: "创建采集任务失败" }, { status: 400 }); }
}
