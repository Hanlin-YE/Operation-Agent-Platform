import { NextResponse } from "next/server";

const agentApiBaseUrl = process.env.AGENT_API_BASE_URL || "http://127.0.0.1:8001";

export async function GET() {
  try {
    const upstream = await fetch(`${agentApiBaseUrl}/api/graph`, { cache: "no-store" });
    return new NextResponse(await upstream.text(), {
      status: upstream.status,
      headers: { "content-type": upstream.headers.get("content-type") || "application/json" }
    });
  } catch {
    return NextResponse.json({ message: "Neo4j 图谱服务未启动，请先启动 agent_root。" }, { status: 503 });
  }
}
