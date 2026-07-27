import { NextResponse } from "next/server";
import { getVideoAnalyzerUrl } from "@/server/videoAnalysis/service";

export const runtime = "nodejs";

function getAgentHealthUrl() {
  const analyzerUrl = new URL(getVideoAnalyzerUrl());
  analyzerUrl.pathname = "/healthz";
  analyzerUrl.search = "";
  analyzerUrl.hash = "";
  return analyzerUrl.toString();
}

export async function GET() {
  const healthUrl = getAgentHealthUrl();
  try {
    const response = await fetch(healthUrl, { cache: "no-store", signal: AbortSignal.timeout(2500) });
    if (!response.ok) {
      return NextResponse.json({ ok: false, message: `本地 Agent 健康检查失败（HTTP ${response.status}）。`, healthUrl }, { status: 503 });
    }
    return NextResponse.json({ ok: true, message: "本地 Agent 已连接。", healthUrl });
  } catch {
    return NextResponse.json({ ok: false, message: "视频分析服务未连接。请启动本地 Agent 并检查 VIDEO_ANALYZER_BASE_URL。", healthUrl }, { status: 503 });
  }
}
