import { NextRequest, NextResponse } from "next/server";

const agentApiBaseUrl = process.env.AGENT_API_BASE_URL || "http://127.0.0.1:8001";

async function forward(request: NextRequest, path: string[]) {
  const upstream = await fetch(`${agentApiBaseUrl}/api/runs/${path.join("/")}`, {
    method: request.method,
    headers: request.method === "POST" ? { "content-type": "application/json" } : undefined,
    body: request.method === "POST" ? await request.text() : undefined,
    cache: "no-store"
  });

  const body = await upstream.text();
  return new NextResponse(body, {
    status: upstream.status,
    headers: { "content-type": upstream.headers.get("content-type") || "application/json" }
  });
}

export async function GET(request: NextRequest, context: { params: { path: string[] } }) {
  try {
    return await forward(request, context.params.path);
  } catch {
    return NextResponse.json({ message: "Agent 服务未启动，请先启动 agent_root API。" }, { status: 503 });
  }
}

export async function POST(request: NextRequest, context: { params: { path: string[] } }) {
  try {
    return await forward(request, context.params.path);
  } catch {
    return NextResponse.json({ message: "Agent 服务未启动，请先启动 agent_root API。" }, { status: 503 });
  }
}
