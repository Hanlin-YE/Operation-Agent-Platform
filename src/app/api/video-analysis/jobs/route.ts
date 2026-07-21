import { NextResponse } from "next/server";
import { getVideoAnalysisJobsUrl, parseVideoAnalysisResult } from "@/server/videoAnalysis/service";

export const runtime = "nodejs";
const maxBytes = 300 * 1024 * 1024;

export async function POST(request: Request) {
  const form = await request.formData();
  const file = form.get("video");
  const sourceUrl = String(form.get("sourceUrl") || "").trim();
  if ((file instanceof File) === Boolean(sourceUrl)) return NextResponse.json({ error: "请选择一个视频文件，或提供一个公开视频链接。" }, { status: 422 });
  if (file instanceof File && !file.type.startsWith("video/")) return NextResponse.json({ error: "仅支持视频文件。" }, { status: 415 });
  if (file instanceof File && (!file.size || file.size > maxBytes)) return NextResponse.json({ error: "视频文件需在 300MB 以内。" }, { status: 422 });
  const outbound = new FormData();
  if (file instanceof File) outbound.set("video", file, file.name); else outbound.set("source_url", sourceUrl);
  try {
    const response = await fetch(getVideoAnalysisJobsUrl(), { method: "POST", body: outbound, cache: "no-store" });
    const payload = await response.json().catch(() => ({ error: "视频分析服务返回了无法识别的内容。" }));
    if (!response.ok) return NextResponse.json({ error: String(payload.detail || payload.error || "视频分析服务暂不可用。"), status: "failed" }, { status: response.status });
    return NextResponse.json(parseVideoAnalysisResult(payload), { status: response.status });
  } catch {
    return NextResponse.json({ error: "视频分析服务未连接。请启动本地 Agent 并配置 VIDEO_ANALYZER_BASE_URL。", status: "failed" }, { status: 503 });
  }
}
