import { NextResponse } from "next/server";

export const runtime = "nodejs";

const agentApiBaseUrl = process.env.AGENT_API_BASE_URL?.trim() || "http://127.0.0.1:8001";

export async function POST(request: Request) {
  try {
    const upstream = await fetch(`${agentApiBaseUrl}/api/graph/import/confirm`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: await request.text(),
      cache: "no-store"
    });
    return new NextResponse(await upstream.arrayBuffer(), {
      status: upstream.status,
      headers: { "content-type": upstream.headers.get("content-type") || "application/json" }
    });
  } catch {
    return NextResponse.json({ error: "graph_import_unavailable", message: "Neo4j 导入服务未连接，请启动 agent_root FastAPI 服务后重试。" }, { status: 503 });
  }
}
