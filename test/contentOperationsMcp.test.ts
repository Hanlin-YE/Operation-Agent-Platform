import assert from "node:assert/strict";
import test from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createContentOperationsMcpServer } from "@/mcp/contentOperationsServer";

process.env.DEMO_EPHEMERAL_STORE = "true";

const seriesId = "series_demo_coreless_motor";

function readText(response: unknown) {
  if (!response || typeof response !== "object" || !("content" in response)) return "";
  const contentValue = (response as { content: unknown }).content;
  const content = Array.isArray(contentValue) ? contentValue as Array<{ type?: string; text?: string }> : [];
  return content[0]?.type === "text" ? content[0].text || "" : "";
}

test("MCP 暴露六个内容运营工具，并使用 snake_case 分析契约", async () => {
  const server = createContentOperationsMcpServer();
  const client = new Client({ name: "content-operations-test-client", version: "0.1.0" });
  const [clientTransport, serverTransport] = await InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);

  const tools = await client.listTools();
  assert.deepEqual(
    tools.tools.map((tool) => tool.name).sort(),
    [
      "configure_video_cta",
      "generate_optimization_brief",
      "query_video_performance",
      "record_web_event",
      "register_video_version",
      "sync_platform_metrics",
    ],
  );
  assert.ok(tools.tools.find((tool) => tool.name === "query_video_performance")?.inputSchema);

  const response = await client.callTool({
    name: "query_video_performance",
    arguments: {
      series_id: seriesId,
      video_version_ids: ["version_demo_v1", "version_demo_v2"],
      channel: "web",
      from: "2026-07-07",
      to: "2026-07-20",
    },
  });
  assert.equal(response.isError, undefined);
  const payload = JSON.parse(readText(response) || "{}") as Record<string, unknown>;
  assert.deepEqual(payload.metric_window, { from: "2026-07-07", to: "2026-07-20" });
  assert.deepEqual(payload.source_precision, ["网页端，毫秒级精确事件"]);
  assert.equal(Array.isArray(payload.metrics), true);
  const comparisons = payload.comparison as Array<{ metric: string }>;
  assert.ok(comparisons.some((comparison) => comparison.metric === "cta_click_rate"));
  assert.equal(JSON.stringify(payload).includes("session_demo"), false);

  const brief = await client.callTool({
    name: "generate_optimization_brief",
    arguments: {
      series_id: seriesId,
      channel: "web",
      from: "2026-07-07",
      to: "2026-07-20",
      target: "cta",
    },
  });
  assert.equal(brief.isError, undefined);
  const briefPayload = JSON.parse(readText(brief) || "{}") as { recommendations?: Array<Record<string, unknown>> };
  assert.ok((briefPayload.recommendations || []).some((item) => typeof item.data_precision === "string" && typeof item.recommended_action === "string"));

  const invalidEvent = await client.callTool({
    name: "record_web_event",
    arguments: {
      event_id: "event-invalid-progress",
      event_name: "play_progress",
      video_version_id: "version_demo_v1",
      session_id: "short",
      position_ms: 100,
      progress_percent: 42,
    },
  });
  assert.equal(invalidEvent.isError, true);
  assert.match(readText(invalidEvent), /sessionId|session_id|progress/i);

  await client.close();
  await server.close();
});

test("MCP 平台单快照明确标记为 manual_entry，不冒充官方同步", async () => {
  const server = createContentOperationsMcpServer();
  const client = new Client({ name: "content-operations-sync-test-client", version: "0.1.0" });
  const [clientTransport, serverTransport] = await InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);

  const response = await client.callTool({
    name: "sync_platform_metrics",
    arguments: {
      publication_id: "publication_v1_bilibili",
      metric_date: "2026-07-20",
      synced_at: "2026-07-20T23:00:00.000Z",
      metric_mode: "daily",
      metrics: { views: 1000, likes: 20, comments: 4, shares: 3, coins: 2, favorites: 5, danmaku: 1 },
    },
  });
  assert.equal(response.isError, undefined);
  const payload = JSON.parse(readText(response) || "{}") as Record<string, unknown>;
  assert.equal(payload.source, "manual_entry");
  assert.equal(payload.status, "manual_entry_recorded");

  await client.close();
  await server.close();
});
