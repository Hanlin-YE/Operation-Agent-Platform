import { NextRequest, NextResponse } from "next/server";

const agentApiBaseUrl = process.env.AGENT_API_BASE_URL || "http://127.0.0.1:8001";

export async function POST(request: NextRequest) {
  try {
    const upstream = await fetch(`${agentApiBaseUrl}/api/runs`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: await request.text(),
      cache: "no-store"
    });
    return new NextResponse(await upstream.text(), {
      status: upstream.status,
      headers: { "content-type": upstream.headers.get("content-type") || "application/json" }
    });
  } catch {
    return NextResponse.json({ message: "Agent 服务未启动，请先启动 agent_root API。" }, { status: 503 });
  }
}
