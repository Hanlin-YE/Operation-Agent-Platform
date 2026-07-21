import { NextResponse } from "next/server";
import { getVideoAnalysisJobsUrl, parseVideoAnalysisResult } from "@/server/videoAnalysis/service";

export const runtime = "nodejs";

export async function GET(_: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  try {
    const response = await fetch(getVideoAnalysisJobsUrl(jobId), { cache: "no-store" });
    const payload = await response.json().catch(() => ({ error: "视频分析服务返回了无法识别的内容。" }));
    if (!response.ok) return NextResponse.json({ error: String(payload.detail || payload.error || "无法读取视频分析任务。"), status: "failed" }, { status: response.status });
    return NextResponse.json(parseVideoAnalysisResult(payload));
  } catch {
    return NextResponse.json({ error: "视频分析服务未连接。", status: "failed" }, { status: 503 });
  }
}
