import assert from "node:assert/strict";
import test from "node:test";
import { POST as postFeedback } from "@/app/api/content-operations/feedback/route";
import { POST as postSeries } from "@/app/api/content-operations/series/route";
import {
  ContentOperationsRepositoryError,
  appendPlatformMetricSnapshot,
  bulkAddAssetReferences,
  createChannelPublication,
  createContentSeries,
  listViewerEvents,
  listViewerFeedback,
  listVideoVersions,
  recordViewerEvent,
  registerVideoVersion,
  updatePublicationLedger,
  upsertViewerFeedback
} from "@/server/content-operations/repository";
import { AssetReferenceDraft } from "@/server/content-operations/repository";
import { calculateChannelPerformances } from "@/server/content-operations/performance";
import { readContentOperationsData } from "@/server/content-operations/store";

process.env.DEMO_EPHEMERAL_STORE = "true";
delete (globalThis as typeof globalThis & { __CONTENT_OPERATIONS_STORE__?: unknown }).__CONTENT_OPERATIONS_STORE__;

let sequence = 0;

function unique(prefix: string) {
  sequence += 1;
  return `${prefix}-${process.pid}-${sequence}`;
}

async function expectRepositoryError(promise: Promise<unknown>, code: string) {
  await assert.rejects(promise, (error: unknown) => {
    assert.ok(error instanceof ContentOperationsRepositoryError);
    assert.equal(error.code, code);
    return true;
  });
}

async function createSeriesWithVersion(status: "draft" | "published" = "published") {
  const created = await createContentSeries({
    name: unique("系列"),
    businessGoal: "验证内容运营数据入口。"
  });
  const registered = await registerVideoVersion({
    seriesId: created.series.id,
    versionNumber: "v1",
    durationMs: 90_000,
    status,
    publishedAt: status === "published" ? "2026-07-01T00:00:00.000Z" : null
  });
  return { series: created.series, version: registered.version };
}

test("非法 JSON 字段返回 4xx，而不是把运行时类型错误暴露为 500", async () => {
  const response = await postSeries(new Request("http://localhost/api/content-operations/series", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: 42, businessGoal: "目标" })
  }));
  const payload = await response.json() as { error: string };

  assert.equal(response.status, 422);
  assert.equal(payload.error, "invalid_name");
});

test("同一系列的版本号大小写不敏感且必须唯一", async () => {
  const { series } = await createSeriesWithVersion();

  await expectRepositoryError(registerVideoVersion({
    seriesId: series.id,
    versionNumber: "V1",
    durationMs: 90_000,
    status: "published",
    publishedAt: "2026-07-02T00:00:00.000Z"
  }), "duplicate_version_number");
});

test("草稿版本不能绑定渠道，同版本同渠道也不能重复绑定", async () => {
  const draft = await createSeriesWithVersion("draft");
  await expectRepositoryError(createChannelPublication(draft.version.id, {
    channel: "web",
    platformVideoId: unique("web"),
    publicationUrl: "https://example.invalid/web/draft",
    publishedAt: "2026-07-01T00:00:00.000Z"
  }), "version_not_published");

  const published = await createSeriesWithVersion();
  await createChannelPublication(published.version.id, {
    channel: "web",
    platformVideoId: unique("web"),
    publicationUrl: "https://example.invalid/web/one",
    publishedAt: "2026-07-01T00:00:00.000Z"
  });
  await expectRepositoryError(createChannelPublication(published.version.id, {
    channel: "web",
    platformVideoId: unique("web"),
    publicationUrl: "https://example.invalid/web/two",
    publishedAt: "2026-07-02T00:00:00.000Z"
  }), "duplicate_version_channel");
});

test("CTA 必须位于视频内，重叠 CTA 必须使用不同优先级", async () => {
  const created = await createContentSeries({ name: unique("CTA系列"), businessGoal: "验证 CTA 规则。" });

  await expectRepositoryError(registerVideoVersion({
    seriesId: created.series.id,
    versionNumber: "v1",
    durationMs: 60_000,
    ctas: [{
      startMs: 55_000,
      endMs: 61_000,
      label: "超出时长",
      targetAgentId: "agent-tech",
      targetUrl: "https://example.invalid/agent",
      priority: 1
    }]
  }), "invalid_cta_window");

  await expectRepositoryError(registerVideoVersion({
    seriesId: created.series.id,
    versionNumber: "v1",
    durationMs: 60_000,
    ctas: [
      { startMs: 10_000, endMs: 20_000, label: "A", targetAgentId: "agent-a", targetUrl: "https://example.invalid/a", priority: 1 },
      { startMs: 15_000, endMs: 25_000, label: "B", targetAgentId: "agent-b", targetUrl: "https://example.invalid/b", priority: 1 }
    ]
  }), "ambiguous_cta_priority");

  assert.equal((await listVideoVersions(created.series.id)).length, 0);
});

test("网页事件要求稳定 ID、合法位置和阈值，且不保存原始 sessionId", async () => {
  const { version } = await createSeriesWithVersion();
  const sessionId = unique("raw-session-value");

  await expectRepositoryError(recordViewerEvent({
    eventName: "play_start",
    videoVersionId: version.id,
    sessionId,
    positionMs: 0
  }), "event_id_required");
  await expectRepositoryError(recordViewerEvent({
    eventId: unique("event"),
    eventName: "play_progress",
    videoVersionId: version.id,
    sessionId,
    positionMs: 30_000,
    progressPercent: 42
  }), "invalid_progress_threshold");

  const eventId = unique("event");
  const accepted = await recordViewerEvent({
    eventId,
    eventName: "play_start",
    videoVersionId: version.id,
    sessionId,
    positionMs: 0,
    occurredAt: "2000-01-01T00:00:00.000Z"
  });
  const events = await listViewerEvents(version.id);

  assert.equal(accepted.id, eventId);
  assert.notEqual(accepted.occurredAt, "2000-01-01T00:00:00.000Z");
  assert.notEqual(accepted.sessionHash, sessionId);
  assert.ok(!JSON.stringify(events).includes(sessionId));

  await expectRepositoryError(recordViewerEvent({
    eventId,
    eventName: "play_start",
    videoVersionId: version.id,
    sessionId: unique("different-session"),
    positionMs: 0
  }), "event_id_conflict");
});

test("反馈拒绝联系方式，重试只保留一条反馈和一条提交事件", async () => {
  const { version } = await createSeriesWithVersion();
  const sessionId = unique("feedback-session");
  const base = {
    videoVersionId: version.id,
    sessionId,
    comprehensionScore: 4,
    interestScore: 3,
    trustScore: 5,
    positionMs: 20_000
  };

  await expectRepositoryError(upsertViewerFeedback({ ...base, comment: "请联系 13800138000" }), "contact_details_forbidden");
  const first = await upsertViewerFeedback({ ...base, comment: "术语可以更简洁。" });
  const second = await upsertViewerFeedback({ ...base, interestScore: 4, comment: "第二次修改。" });

  assert.equal(first.id, second.id);
  assert.equal((await listViewerFeedback(version.id)).length, 1);
  assert.equal((await listViewerEvents(version.id)).filter((item) => item.eventName === "feedback_submit").length, 1);

  const response = await postFeedback(new Request("http://localhost/api/content-operations/feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...base, sessionId: unique("api-feedback-session") })
  }));
  const payload = await response.json() as Record<string, unknown>;
  assert.equal(response.status, 201);
  assert.equal(payload.accepted, true);
  assert.equal(typeof payload.feedbackId, "string");
  assert.equal("sessionHash" in payload, false);
});

test("最新平台同步失败会阻止比较，后续成功重试可恢复", async () => {
  const { series, version } = await createSeriesWithVersion();
  const publication = await createChannelPublication(version.id, {
    channel: "bilibili",
    platformVideoId: unique("bilibili"),
    publicationUrl: "https://example.invalid/bilibili/video",
    publishedAt: "2026-07-01T00:00:00.000Z"
  });
  const metrics = {
    views: 1_000,
    likes: 60,
    comments: 10,
    shares: 8,
    coins: 6,
    favorites: 12,
    danmaku: 4
  };

  for (let day = 1; day <= 7; day += 1) {
    const date = `2026-07-0${day}`;
    await appendPlatformMetricSnapshot(publication.id, {
      metricDate: date,
      syncedAt: `${date}T10:00:00.000Z`,
      metricMode: "daily",
      metrics,
      source: "official_api"
    });
  }
  await appendPlatformMetricSnapshot(publication.id, {
    metricDate: "2026-07-04",
    syncedAt: "2026-07-04T11:00:00.000Z",
    metricMode: "daily",
    syncStatus: "failed",
    errorSummary: "官方接口超时",
    source: "official_api"
  });

  let data = await readContentOperationsData();
  let performance = calculateChannelPerformances({
    data,
    versions: [data.videoVersions.find((item) => item.id === version.id)!],
    channel: "bilibili",
    window: { from: "2026-07-01", to: "2026-07-07" }
  })[0];
  assert.equal(performance.seriesId, series.id);
  assert.equal(performance.eligibility, "data_gap");
  assert.ok(performance.dataGaps.some((item) => item.code === "sync_failed"));

  await appendPlatformMetricSnapshot(publication.id, {
    metricDate: "2026-07-04",
    syncedAt: "2026-07-04T12:00:00.000Z",
    metricMode: "daily",
    metrics,
    source: "official_api"
  });
  data = await readContentOperationsData();
  performance = calculateChannelPerformances({
    data,
    versions: [data.videoVersions.find((item) => item.id === version.id)!],
    channel: "bilibili",
    window: { from: "2026-07-01", to: "2026-07-07" }
  })[0];
  assert.equal(performance.eligibility, "valid");
});

test("相同平台快照幂等键使用不同负载时返回冲突", async () => {
  const { version } = await createSeriesWithVersion();
  const publication = await createChannelPublication(version.id, {
    channel: "douyin",
    platformVideoId: unique("douyin"),
    publicationUrl: "https://example.invalid/douyin/video",
    publishedAt: "2026-07-01T00:00:00.000Z"
  });
  const common = {
    metricDate: "2026-07-01",
    syncedAt: "2026-07-01T10:00:00.000Z",
    metricMode: "daily" as const,
    source: "official_api" as const
  };
  await appendPlatformMetricSnapshot(publication.id, { ...common, metrics: { views: 100 } });
  await expectRepositoryError(
    appendPlatformMetricSnapshot(publication.id, { ...common, metrics: { views: 101 } }),
    "snapshot_idempotency_conflict"
  );
});

test("bulkAddAssetReferences 成功批量登记多条资产，按入参顺序返回", async () => {
  const { version } = await createSeriesWithVersion();
  const created = await bulkAddAssetReferences(version.id, [
    { assetType: "video", assetVersion: "release-1", referenceUrl: "https://example.com/a.mp4", summary: "首版视频" },
    { assetType: "storyboard", assetVersion: "draft-1", referenceUrl: "https://example.com/b.png", summary: "分镜图" }
  ]);
  assert.equal(created.length, 2);
  assert.equal(created[0].assetType, "video");
  assert.equal(created[1].assetType, "storyboard");
  const all = await readContentOperationsData();
  const stored = all.assetReferences.filter((item) => item.videoVersionId === version.id);
  assert.equal(stored.length, 2);
});

test("bulkAddAssetReferences Version 不存在返回 not_found/version_not_found", async () => {
  await expectRepositoryError(
    bulkAddAssetReferences("version_does_not_exist", [
      { assetType: "video", assetVersion: "v1", referenceUrl: "https://example.com/a.mp4", summary: "foo" }
    ]),
    "version_not_found"
  );
});

test("bulkAddAssetReferences 空数组与超 20 条返回 batch_size_invalid", async () => {
  const { version } = await createSeriesWithVersion();
  await expectRepositoryError(
    bulkAddAssetReferences(version.id, []),
    "batch_size_invalid"
  );
  const many: AssetReferenceDraft[] = Array.from({ length: 21 }, (_, i) => ({
    assetType: "video" as const,
    assetVersion: `v${i}`,
    referenceUrl: `https://example.com/${i}.mp4`,
    summary: `s${i}`
  }));
  await expectRepositoryError(
    bulkAddAssetReferences(version.id, many),
    "batch_size_invalid"
  );
});

test("bulkAddAssetReferences 批量内两条 (assetType, assetVersion) 重复返回 duplicate_in_batch", async () => {
  const { version } = await createSeriesWithVersion();
  await expectRepositoryError(
    bulkAddAssetReferences(version.id, [
      { assetType: "video", assetVersion: "v1", referenceUrl: "https://example.com/a.mp4", summary: "a" },
      { assetType: "video", assetVersion: "V1", referenceUrl: "https://example.com/b.mp4", summary: "b" }
    ]),
    "duplicate_in_batch"
  );
});

test("bulkAddAssetReferences 与既有 (assetType, assetVersion) 冲突返回 duplicate_asset_reference", async () => {
  const { version } = await createSeriesWithVersion();
  await bulkAddAssetReferences(version.id, [
    { assetType: "video", assetVersion: "v1", referenceUrl: "https://example.com/a.mp4", summary: "a" }
  ]);
  await expectRepositoryError(
    bulkAddAssetReferences(version.id, [
      { assetType: "video", assetVersion: "v1", referenceUrl: "https://example.com/b.mp4", summary: "b" }
    ]),
    "duplicate_asset_reference"
  );
});

test("bulkAddAssetReferences URL 含嵌入凭证返回 invalid_referenceUrl", async () => {
  const { version } = await createSeriesWithVersion();
  await expectRepositoryError(
    bulkAddAssetReferences(version.id, [
      { assetType: "video", assetVersion: "v1", referenceUrl: "https://user:pass@example.com/a.mp4", summary: "a" }
    ]),
    "invalid_referenceUrl"
  );
});

test("bulkAddAssetReferences 任一校验失败时不写入任何资产", async () => {
  const { version } = await createSeriesWithVersion();
  const before = (await readContentOperationsData()).assetReferences.length;
  await assert.rejects(
    bulkAddAssetReferences(version.id, [
      { assetType: "video", assetVersion: "v1", referenceUrl: "https://example.com/a.mp4", summary: "a" },
      { assetType: "video", assetVersion: "v2", referenceUrl: "https://example.com/b.mp4", summary: "x".repeat(201) }
    ]),
  );
  const after = (await readContentOperationsData()).assetReferences.length;
  assert.equal(after, before, "失败时不应写入任何资产");
});

test("registerVideoVersion 接受并返回发布台账字段（title/batch/publishedBy/approvedBy）", async () => {
  const created = await createContentSeries({ name: unique("台账系列"), businessGoal: "台账" });
  const registered = await registerVideoVersion({
    seriesId: created.series.id,
    versionNumber: "v1",
    durationMs: 30_000,
    status: "published",
    publishedAt: "2026-07-21T00:00:00.000Z",
    title: "空心杯电机品牌片",
    batch: "2026-07-A",
    publishedBy: "运营-子安",
    approvedBy: "技术负责人"
  });
  assert.equal(registered.version.title, "空心杯电机品牌片");
  assert.equal(registered.version.batch, "2026-07-A");
  assert.equal(registered.version.publishedBy, "运营-子安");
  assert.equal(registered.version.approvedBy, "技术负责人");
});

test("registerVideoVersion 台账字段越界返回 validation 错误", async () => {
  const created = await createContentSeries({ name: unique("越界系列"), businessGoal: "x" });
  await expectRepositoryError(registerVideoVersion({
    seriesId: created.series.id,
    versionNumber: "v-long-title",
    durationMs: 30_000,
    status: "published",
    publishedAt: "2026-07-21T00:00:00.000Z",
    title: "x".repeat(121)
  }), "invalid_title");
  await expectRepositoryError(registerVideoVersion({
    seriesId: created.series.id,
    versionNumber: "v-long-batch",
    durationMs: 30_000,
    status: "published",
    publishedAt: "2026-07-21T00:00:00.000Z",
    batch: "x".repeat(41)
  }), "invalid_batch");
});

test("updatePublicationLedger 成功更新台账字段，Version 不存在返回 not_found", async () => {
  const { version } = await createSeriesWithVersion();
  const updated = await updatePublicationLedger(version.id, {
    title: "更新后标题",
    batch: "batch-X",
    publishedBy: "运营-甲",
    approvedBy: "审批-乙"
  });
  assert.equal(updated.title, "更新后标题");
  assert.equal(updated.batch, "batch-X");
  assert.equal(updated.publishedBy, "运营-甲");
  assert.equal(updated.approvedBy, "审批-乙");

  await expectRepositoryError(
    updatePublicationLedger("version_does_not_exist", { title: "x" }),
    "version_not_found"
  );
});

test("updatePublicationLedger 允许草稿确认发布，并要求实际发布时间", async () => {
  const { version } = await createSeriesWithVersion("draft");
  const published = await updatePublicationLedger(version.id, {
    status: "published",
    publishedAt: "2026-07-21T09:55:00.000Z",
    publishedBy: "运营-甲"
  });
  assert.equal(published.status, "published");
  assert.equal(published.publishedAt, "2026-07-21T09:55:00.000Z");
  assert.equal(published.publishedBy, "运营-甲");

  await expectRepositoryError(
    updatePublicationLedger(published.id, { status: "published", publishedAt: "2026-07-21T10:00:00.000Z" }),
    "invalid_status_transition"
  );
});

test("updatePublicationLedger 字段越界返回 validation 错误", async () => {
  const { version } = await createSeriesWithVersion();
  await expectRepositoryError(
    updatePublicationLedger(version.id, { publishedBy: "x".repeat(61) }),
    "invalid_publishedBy"
  );
});
