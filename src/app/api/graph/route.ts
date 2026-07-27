import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";

const agentApiBaseUrl = process.env.AGENT_API_BASE_URL || "http://127.0.0.1:8001";
const localSnapshotPath = path.join(process.cwd(), "data", "neo4j-graph-snapshot.json");

async function localGraphSnapshot() {
  const snapshot = await readFile(localSnapshotPath, "utf-8");
  return NextResponse.json(JSON.parse(snapshot), {
    headers: {
      "x-graph-source": "local-snapshot"
    }
  });
}

export async function GET() {
  try {
    const upstream = await fetch(`${agentApiBaseUrl}/api/graph`, { cache: "no-store" });
    if (!upstream.ok) return localGraphSnapshot();
    return new NextResponse(await upstream.text(), {
      status: upstream.status,
      headers: {
        "content-type": upstream.headers.get("content-type") || "application/json",
        "x-graph-source": "agent-api"
      }
    });
  } catch {
    return localGraphSnapshot();
  }
}
