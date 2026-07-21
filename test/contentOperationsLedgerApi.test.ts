import assert from "node:assert/strict";
import test from "node:test";
import {
  createContentSeries,
  registerVideoVersion,
} from "@/server/content-operations/repository";

process.env.DEMO_EPHEMERAL_STORE = "true";
delete (globalThis as typeof globalThis & { __CONTENT_OPERATIONS_STORE__?: unknown }).__CONTENT_OPERATIONS_STORE__;

let sequence = 0;
function unique(prefix: string) {
  sequence += 1;
  return `${prefix}-${process.pid}-${sequence}`;
}

async function createPublishedVersion() {
  const created = await createContentSeries({
    name: unique("ledger系列"),
    businessGoal: "验证 ledger API。"
  });
  const registered = await registerVideoVersion({
    seriesId: created.series.id,
    versionNumber: "v1",
    durationMs: 60_000,
    status: "published",
    publishedAt: "2026-07-21T00:00:00.000Z",
    title: "初始标题"
  });
  return { series: created.series, version: registered.version };
}

function ledgerPatch(versionId: string, patch: Record<string, string | null>) {
  const url = `http://localhost/api/content-operations/versions/${versionId}/ledger`;
  return new Request(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch)
  });
}

test("PATCH /versions/[id]/ledger 成功更新台账字段并返回 200", async () => {
  const { version } = await createPublishedVersion();
  const { PATCH } = await import("@/app/api/content-operations/versions/[versionId]/ledger/route");
  const response = await PATCH(ledgerPatch(version.id, {
    title: "更新后标题",
    batch: "batch-001",
    publishedBy: "运营甲",
    approvedBy: "审批乙"
  }), { params: Promise.resolve({ versionId: version.id }) });
  const payload = await response.json() as { version: { title: string; batch: string; publishedBy: string; approvedBy: string } };

  assert.equal(response.status, 200);
  assert.equal(payload.version.title, "更新后标题");
  assert.equal(payload.version.batch, "batch-001");
  assert.equal(payload.version.publishedBy, "运营甲");
  assert.equal(payload.version.approvedBy, "审批乙");
});

test("PATCH /versions/[id]/ledger Version 不存在返回 404", async () => {
  const { PATCH } = await import("@/app/api/content-operations/versions/[versionId]/ledger/route");
  const response = await PATCH(ledgerPatch("missing-version", { title: "x" }), { params: Promise.resolve({ versionId: "missing-version" }) });
  assert.equal(response.status, 404);
});

test("PATCH /versions/[id]/ledger 字段越界返回 422", async () => {
  const { version } = await createPublishedVersion();
  const { PATCH } = await import("@/app/api/content-operations/versions/[versionId]/ledger/route");
  const response = await PATCH(ledgerPatch(version.id, { publishedBy: "x".repeat(61) }), { params: Promise.resolve({ versionId: version.id }) });
  assert.equal(response.status, 422);
});

test("PATCH /versions/[id]/ledger 非 JSON 返回 400", async () => {
  const { version } = await createPublishedVersion();
  const { PATCH } = await import("@/app/api/content-operations/versions/[versionId]/ledger/route");
  const response = await PATCH(new Request(`http://localhost/api/content-operations/versions/${version.id}/ledger`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: "{not json"
  }), { params: Promise.resolve({ versionId: version.id }) });
  assert.equal(response.status, 400);
});