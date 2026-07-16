import { NextRequest, NextResponse } from "next/server";
import { handleDemoRagGet, handleDemoRagPost } from "@/server/rag/demoRouteHandlers";

export const runtime = "nodejs";

const agentApiBaseUrl = process.env.AGENT_API_BASE_URL?.trim() || "http://127.0.0.1:8001";

async function forward(request: NextRequest, path: string[]) {
  const hasBody = !["GET", "HEAD"].includes(request.method);
  const headers = new Headers();
  const contentType = request.headers.get("content-type");
  if (contentType) {
    headers.set("content-type", contentType);
  }
  const upstream = await fetch(`${agentApiBaseUrl}/api/rag/${path.join("/")}`, {
    method: request.method,
    headers,
    body: hasBody ? await request.arrayBuffer() : undefined,
    cache: "no-store"
  });
  return new NextResponse(await upstream.arrayBuffer(), {
    status: upstream.status,
    headers: { "content-type": upstream.headers.get("content-type") || "application/json" }
  });
}

export async function GET(request: NextRequest, context: { params: { path: string[] } }) {
  try {
    return await forward(request, context.params.path);
  } catch {
    return handleDemoRagGet(context.params.path);
  }
}

export async function POST(request: NextRequest, context: { params: { path: string[] } }) {
  const fallbackRequest = request.clone();
  try {
    return await forward(request, context.params.path);
  } catch {
    try {
      return await handleDemoRagPost(fallbackRequest, context.params.path);
    } catch (error) {
      return NextResponse.json(
        { detail: error instanceof Error ? error.message : "PDF 处理失败" },
        { status: 500 }
      );
    }
  }
}
