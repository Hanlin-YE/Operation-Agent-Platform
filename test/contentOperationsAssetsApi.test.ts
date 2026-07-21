import assert from "node:assert/strict";
import test from "node:test";
import { POST as postAssets } from "@/app/api/content-operations/assets/route";
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
    name: unique("桥接系列"),
    businessGoal: "验证桥接 API。"
  });
  const registered = await registerVideoVersion({
    seriesId: created.series.id,
    versionNumber: "v1",
    durationMs: 60_000,
    status: "published",
    publishedAt: "2026-07-01T00:00:00.000Z"
  });
  return { series: created.series, version: registered.version };
}

function assetBody(videoVersionId: string | undefined, assets: Array<Record<string, string>>) {
  return new Request("http://localhost/api/content-operations/assets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ videoVersionId, assets })
  });
}

test("POST /api/content-operations/assets 批量登记成功返回 201 createdIds", async () => {
  const { version } = await createPublishedVersion();
  const response = await postAssets(assetBody(version.id, [
    { assetType: "video", assetVersion: "v1", referenceUrl: "https://example.com/a.mp4", summary: "首版" },
    { assetType: "storyboard", assetVersion: "draft", referenceUrl: "https://example.com/b.png", summary: "分镜" }
  ]));
  const payload = await response.json() as { accepted: boolean; createdIds: string[]; assets: { id: string }[] };

  assert.equal(response.status, 201);
  assert.equal(payload.accepted, true);
  assert.equal(payload.createdIds.length, 2);
  assert.equal(payload.assets.length, 2);
});

test("POST /api/content-operations/assets Version 不存在返回 404 version_not_found", async () => {
  const response = await postAssets(assetBody("missing-version", [
    { assetType: "video", assetVersion: "v1", referenceUrl: "https://example.com/a.mp4", summary: "s" }
  ]));
  const payload = await response.json() as { error: string };

  assert.equal(response.status, 404);
  assert.equal(payload.error, "version_not_found");
});

test("POST /api/content-operations/assets 批内重复返回 422 duplicate_in_batch", async () => {
  const { version } = await createPublishedVersion();
  const response = await postAssets(assetBody(version.id, [
    { assetType: "video", assetVersion: "v1", referenceUrl: "https://example.com/a.mp4", summary: "a" },
    { assetType: "video", assetVersion: "V1", referenceUrl: "https://example.com/b.mp4", summary: "b" }
  ]));
  const payload = await response.json() as { error: string };

  assert.equal(response.status, 422);
  assert.equal(payload.error, "duplicate_in_batch");
});

test("POST /api/content-operations/assets 与既有冲突返回 409 duplicate_asset_reference", async () => {
  const { version } = await createPublishedVersion();
  await postAssets(assetBody(version.id, [
    { assetType: "video", assetVersion: "v1", referenceUrl: "https://example.com/a.mp4", summary: "a" }
  ]));
  const response = await postAssets(assetBody(version.id, [
    { assetType: "video", assetVersion: "v1", referenceUrl: "https://example.com/b.mp4", summary: "b" }
  ]));
  const payload = await response.json() as { error: string };

  assert.equal(response.status, 409);
  assert.equal(payload.error, "duplicate_asset_reference");
});

test("POST /api/content-operations/assets 超 20 条返回 422 batch_size_invalid", async () => {
  const { version } = await createPublishedVersion();
  const many = Array.from({ length: 21 }, (_, i) => ({
    assetType: "video",
    assetVersion: `v${i}`,
    referenceUrl: `https://example.com/${i}.mp4`,
    summary: `s${i}`
  }));
  const response = await postAssets(assetBody(version.id, many));
  const payload = await response.json() as { error: string };

  assert.equal(response.status, 422);
  assert.equal(payload.error, "batch_size_invalid");
});

test("POST /api/content-operations/assets 空数组返回 422 batch_size_invalid", async () => {
  const { version } = await createPublishedVersion();
  const response = await postAssets(assetBody(version.id, []));
  const payload = await response.json() as { error: string };

  assert.equal(response.status, 422);
  assert.equal(payload.error, "batch_size_invalid");
});

test("POST /api/content-operations/assets 非 JSON 返回 400", async () => {
  const response = await postAssets(new Request("http://localhost/api/content-operations/assets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{not json"
  }));
  assert.equal(response.status, 400);
});

test("POST /api/content-operations/assets 缺 videoVersionId 返回 422", async () => {
  const response = await postAssets(new Request("http://localhost/api/content-operations/assets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ assets: [{ assetType: "video", assetVersion: "v1", referenceUrl: "https://example.com/a.mp4", summary: "s" }] })
  }));
  assert.equal(response.status, 422);
});

test("POST /api/content-operations/assets assets 非数组返回 422", async () => {
  const { version } = await createPublishedVersion();
  const response = await postAssets(new Request("http://localhost/api/content-operations/assets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ videoVersionId: version.id, assets: "not-array" })
  }));
  assert.equal(response.status, 422);
});

test("POST /api/content-operations/assets 单个资产字段缺失返回 422", async () => {
  const { version } = await createPublishedVersion();
  const response = await postAssets(new Request("http://localhost/api/content-operations/assets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ videoVersionId: version.id, assets: [{ assetType: "video", assetVersion: "v1" }] })
  }));
  assert.equal(response.status, 422);
});