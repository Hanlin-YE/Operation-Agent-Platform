import { NextRequest, NextResponse } from "next/server";

const agentApiBaseUrl = process.env.AGENT_API_BASE_URL || "http://127.0.0.1:8001";

async function forward(request: NextRequest, path: string[]) {
  const hasBody = !["GET", "HEAD"].includes(request.method);
  const contentType = request.headers.get("content-type");
  const upstream = await fetch(`${agentApiBaseUrl}/api/rag/${path.join("/")}`, {
    method: request.method,
    headers: contentType ? { "content-type": contentType } : undefined,
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
    return NextResponse.json({ message: "RAG 服务未就绪，请检查 agent_root API。" }, { status: 503 });
  }
}

export async function POST(request: NextRequest, context: { params: { path: string[] } }) {
  try {
    return await forward(request, context.params.path);
  } catch {
    return NextResponse.json({ message: "RAG 服务未就绪，请检查 agent_root API。" }, { status: 503 });
  }
}
