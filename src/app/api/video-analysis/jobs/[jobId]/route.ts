import { NextResponse } from "next/server";
import { getVideoAnalysisJobsUrl, parseVideoAnalysisResult } from "@/server/videoAnalysis/service";

export const runtime = "nodejs";

function videoServiceError(payload: Record<string, unknown>, fallback: string) {
  const message = String(payload.detail || payload.error || fallback);
  if (/^not found$/i.test(message)) {
    return "本地 Agent 未加载视频拆解任务查询路由。请重启或重建 agent_root 服务，确认 /api/video-analysis/jobs/{jobId} 已出现在 8001 的 OpenAPI 路由中。";
  }
  return message;
}

export async function GET(_: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  try {
    const response = await fetch(getVideoAnalysisJobsUrl(jobId), { cache: "no-store" });
    const payload = await response.json().catch(() => ({ error: "视频分析服务返回了无法识别的内容。" }));
    if (!response.ok) return NextResponse.json({ error: videoServiceError(payload, "无法读取视频分析任务。"), status: "failed" }, { status: response.status });
    return NextResponse.json(parseVideoAnalysisResult(payload));
  } catch {
    return NextResponse.json({ error: "视频分析服务未连接。", status: "failed" }, { status: 503 });
  }
}
