import assert from "node:assert/strict";
import test from "node:test";
import {
  assessPlatformCoverage,
  calculatePlatformInteractionRate,
  calculatePlatformPerformance,
  calculateRate,
  calculateWebPerformance,
  compareVersionPerformance,
  generateOptimizationBrief,
  PerformanceCta,
  PerformanceFeedback,
  PerformancePlatformSnapshot,
  PerformanceVersion,
  PerformanceWebEvent,
  VersionPerformance
} from "@/server/content-operations/performance";

const window = { from: "2026-07-01", to: "2026-07-07" };

function version(id: string, seriesId = "series-1"): PerformanceVersion {
  return { videoVersionId: id, seriesId, versionNumber: id, status: "published", publishedAt: "2026-07-01" };
}

function event(
  videoVersionId: string,
  sessionHash: string,
  eventName: PerformanceWebEvent["eventName"],
  fields: Partial<PerformanceWebEvent> = {}
): PerformanceWebEvent {
  return {
    eventId: `${videoVersionId}-${sessionHash}-${eventName}-${fields.ctaId || ""}`,
    eventName,
    videoVersionId,
    channel: "web",
    sessionHash,
    occurredAt: "2026-07-03T08:00:00.000Z",
    ...fields
  };
}

function viewerEvents(videoVersionId: string, viewers: number, completed: number): PerformanceWebEvent[] {
  const events: PerformanceWebEvent[] = [];
  for (let index = 0; index < viewers; index += 1) {
    const session = `session-${index}`;
    events.push(event(videoVersionId, session, "play_start", { positionMs: 0 }));
    events.push(event(videoVersionId, session, "play_progress", {
      positionMs: 60_000,
      progressPercent: index < completed ? 90 : 89
    }));
  }
  return events;
}

function metric(value: number) {
  return { value, status: "available" as const, sampleSize: 30, dataGaps: [] };
}

test("网页完播率按独立会话去重，并以 90% 为完播边界", () => {
  const videoVersion = version("v1");
  const events = viewerEvents(videoVersion.videoVersionId, 30, 18);
  events.push(event(videoVersion.videoVersionId, "session-0", "play_start"));
  events.push(event(videoVersion.videoVersionId, "session-0", "play_progress", { progressPercent: 100, positionMs: 90_000 }));

  const result = calculateWebPerformance({ version: videoVersion, window, events, ctas: [], feedback: [] });

  assert.equal(result.sampleSize, 30);
  assert.equal(result.metrics.completionRate.numerator, 18);
  assert.equal(result.metrics.completionRate.denominator, 30);
  assert.equal(result.metrics.completionRate.value, 0.6);
});

test("CTA 到达、曝光、点击和咨询均按会话去重", () => {
  const videoVersion = version("v1");
  const cta: PerformanceCta = {
    ctaId: "cta-1",
    videoVersionId: videoVersion.videoVersionId,
    label: "技术答疑",
    startMs: 42_000,
    endMs: 55_000
  };
  const events = viewerEvents(videoVersion.videoVersionId, 40, 20);
  for (let index = 0; index < 30; index += 1) {
    events.push(event(videoVersion.videoVersionId, `session-${index}`, "cta_impression", { ctaId: cta.ctaId, positionMs: 43_000 }));
  }
  for (let index = 0; index < 6; index += 1) {
    events.push(event(videoVersion.videoVersionId, `session-${index}`, "cta_click", { ctaId: cta.ctaId, positionMs: 44_000 }));
  }
  for (let index = 0; index < 3; index += 1) {
    events.push(event(videoVersion.videoVersionId, `session-${index}`, "consultation_click", { ctaId: cta.ctaId, positionMs: 45_000 }));
  }
  events.push(event(videoVersion.videoVersionId, "session-0", "cta_impression", { ctaId: cta.ctaId, positionMs: 43_100 }));
  events.push(event(videoVersion.videoVersionId, "session-0", "cta_click", { ctaId: cta.ctaId, positionMs: 44_100 }));

  const result = calculateWebPerformance({ version: videoVersion, window, events, ctas: [cta], feedback: [] });
  const ctaResult = result.ctaPerformance[0];

  assert.equal(ctaResult.reachedSessions, 40);
  assert.equal(ctaResult.exposureRate.value, 0.75);
  assert.equal(ctaResult.clickRate.value, 0.2);
  assert.equal(ctaResult.consultationRate.value, 0.1);
});

test("零分母返回 unavailable，而不是补零", () => {
  const result = calculateRate(0, 0);

  assert.equal(result.value, null);
  assert.equal(result.status, "unavailable");
  assert.equal(result.dataGaps[0].code, "zero_denominator");
});

test("三维评分只采用每个会话的最新反馈", () => {
  const videoVersion = version("v1");
  const feedback: PerformanceFeedback[] = [
    {
      videoVersionId: videoVersion.videoVersionId,
      sessionHash: "session-1",
      occurredAt: "2026-07-02T08:00:00.000Z",
      comprehensionScore: 1,
      interestScore: 1,
      trustScore: 1
    },
    {
      videoVersionId: videoVersion.videoVersionId,
      sessionHash: "session-1",
      occurredAt: "2026-07-03T08:00:00.000Z",
      comprehensionScore: 5,
      interestScore: 4,
      trustScore: 3
    },
    {
      videoVersionId: videoVersion.videoVersionId,
      sessionHash: "session-2",
      occurredAt: "2026-07-03T09:00:00.000Z",
      comprehensionScore: 3,
      interestScore: 2,
      trustScore: 5
    }
  ];

  const result = calculateWebPerformance({
    version: videoVersion,
    window,
    events: viewerEvents(videoVersion.videoVersionId, 30, 15),
    ctas: [],
    feedback
  });

  assert.equal(result.metrics.comprehensionScore.value, 4);
  assert.equal(result.metrics.interestScore.value, 3);
  assert.equal(result.metrics.trustScore.value, 4);
  assert.equal(result.metrics.comprehensionScore.sampleSize, 2);
});

function dailySnapshots(
  videoVersionId: string,
  channel: "douyin" | "bilibili" = "douyin"
): PerformancePlatformSnapshot[] {
  return Array.from({ length: 7 }, (_, index) => ({
    snapshotId: `${videoVersionId}-${index}`,
    videoVersionId,
    channel,
    metricDate: `2026-07-0${index + 1}`,
    syncedAt: `2026-07-0${index + 1}T12:00:00.000Z`,
    metricMode: "daily" as const,
    syncStatus: "success" as const,
    metrics: channel === "douyin"
      ? { views: 1000, likes: 50, comments: 10, shares: 5, reposts: 3, downloads: 2 }
      : { views: 1000, likes: 40, comments: 10, shares: 5, coins: 5, favorites: 8, danmaku: 2 }
  }));
}

test("平台 daily 窗口汇总允许字段并计算互动率", () => {
  const videoVersion = version("v1");
  const result = calculatePlatformPerformance({
    version: videoVersion,
    channel: "douyin",
    window,
    snapshots: dailySnapshots(videoVersion.videoVersionId)
  });

  assert.equal(result.metrics.platformViews.value, 7000);
  assert.equal(result.metrics.platformEngagementRate.value, 0.07);
  assert.equal(result.platformCoverage?.consecutiveDays, 7);
  assert.equal(result.eligibility, "valid");
});

test("平台 cumulative 窗口用窗口前基线计算增量", () => {
  const videoVersion = version("v1");
  const snapshots: PerformancePlatformSnapshot[] = [];
  for (let index = 0; index <= 7; index += 1) {
    const date = index === 0 ? "2026-06-30" : `2026-07-0${index}`;
    snapshots.push({
      videoVersionId: videoVersion.videoVersionId,
      channel: "douyin",
      metricDate: date,
      syncedAt: `${date}T12:00:00.000Z`,
      metricMode: "cumulative",
      metrics: {
        views: 100 + index * 1000,
        likes: 10 + index * 50,
        comments: 2 + index * 10,
        shares: 1 + index * 5,
        reposts: index * 3,
        downloads: index * 2
      }
    });
  }

  const result = calculatePlatformPerformance({ version: videoVersion, channel: "douyin", window, snapshots });

  assert.equal(result.metrics.platformViews.value, 7000);
  assert.equal(result.metrics.platformEngagementRate.value, 0.07);
  assert.equal(result.eligibility, "valid");
});

test("平台 unavailable 字段不补零并阻止比较资格", () => {
  const videoVersion = version("v1");
  const snapshots = dailySnapshots(videoVersion.videoVersionId);
  snapshots[3].metrics.downloads = "unavailable";

  const result = calculatePlatformPerformance({ version: videoVersion, channel: "douyin", window, snapshots });
  const direct = calculatePlatformInteractionRate({
    views: 100,
    allowedInteractionFields: ["likes", "comments"],
    counts: { likes: 5, comments: "unavailable" }
  });

  assert.equal(result.metrics.platformEngagementRate.value, null);
  assert.equal(result.eligibility, "data_gap");
  assert.equal(direct.value, null);
  assert.ok(direct.dataGaps.some((item) => item.field === "comments"));
});

test("平台窗口混用 daily 与 cumulative 时不计算伪指标", () => {
  const videoVersion = version("v1");
  const snapshots = dailySnapshots(videoVersion.videoVersionId);
  snapshots[3].metricMode = "cumulative";

  const result = calculatePlatformPerformance({ version: videoVersion, channel: "douyin", window, snapshots });

  assert.equal(result.eligibility, "data_gap");
  assert.equal(result.metrics.platformViews.value, null);
  assert.ok(result.dataGaps.some((item) => item.code === "mixed_metric_mode"));
});

test("累计窗口只接受紧邻开始日期前一日的基线", () => {
  const videoVersion = version("v1");
  const snapshots: PerformancePlatformSnapshot[] = [{
    videoVersionId: videoVersion.videoVersionId,
    channel: "douyin",
    metricDate: "2026-06-01",
    syncedAt: "2026-06-01T12:00:00.000Z",
    metricMode: "cumulative",
    metrics: { views: 100, likes: 10, comments: 2, shares: 1, reposts: 1, downloads: 1 }
  }];
  for (let index = 1; index <= 7; index += 1) {
    const date = `2026-07-0${index}`;
    snapshots.push({
      videoVersionId: videoVersion.videoVersionId,
      channel: "douyin",
      metricDate: date,
      syncedAt: `${date}T12:00:00.000Z`,
      metricMode: "cumulative",
      metrics: {
        views: 1_000 + index * 100,
        likes: 50 + index * 5,
        comments: 10 + index,
        shares: 5 + index,
        reposts: 3 + index,
        downloads: 2 + index
      }
    });
  }

  const result = calculatePlatformPerformance({ version: videoVersion, channel: "douyin", window, snapshots });

  assert.equal(result.eligibility, "data_gap");
  assert.equal(result.metrics.platformViews.value, null);
  assert.ok(result.dataGaps.some((item) => item.code === "missing_cumulative_baseline"));
});

test("平台趋势要求至少连续七天且窗口无缺日", () => {
  const sixDays = assessPlatformCoverage({
    window: { from: "2026-07-01", to: "2026-07-06" },
    observedMetricDates: ["2026-07-01", "2026-07-02", "2026-07-03", "2026-07-04", "2026-07-05", "2026-07-06"]
  });
  const sevenDays = assessPlatformCoverage({
    window,
    observedMetricDates: ["2026-07-01", "2026-07-02", "2026-07-03", "2026-07-04", "2026-07-05", "2026-07-06", "2026-07-07"]
  });
  const withFailure = assessPlatformCoverage({
    window,
    observedMetricDates: sevenDays.observedDates,
    syncFailedDates: ["2026-07-04"]
  });

  assert.equal(sixDays.eligibleForTrend, false);
  assert.equal(sevenDays.eligibleForTrend, true);
  assert.equal(withFailure.eligibleForTrend, false);
});

function comparablePerformance(id: string, completion: number, score: number, sampleSize = 30): VersionPerformance {
  const result = calculateWebPerformance({
    version: version(id),
    window,
    events: viewerEvents(id, sampleSize, Math.round(sampleSize * completion)),
    ctas: [],
    feedback: []
  });
  return {
    ...result,
    metrics: {
      ...result.metrics,
      completionRate: metric(completion),
      comprehensionScore: metric(score)
    }
  };
}

test("网页 30 会话有效，29 会话只能观察", () => {
  const valid = comparablePerformance("v1", 0.4, 3.2, 30);
  const insufficient = comparablePerformance("v2", 0.7, 4, 29);
  const comparison = compareVersionPerformance(valid, insufficient).find((item) => item.metric === "completionRate");

  assert.equal(valid.eligibility, "valid");
  assert.equal(insufficient.eligibility, "sample_insufficient");
  assert.equal(comparison?.status, "observation_only");
  assert.equal(comparison?.winnerVersionId, undefined);
});

test("比例正好 10 个百分点及评分正好 0.5 分属于明显差异", () => {
  const left = comparablePerformance("v1", 0.4, 3.2);
  const right = comparablePerformance("v2", 0.5, 3.7);
  const comparisons = compareVersionPerformance(left, right);

  assert.equal(comparisons.find((item) => item.metric === "completionRate")?.status, "obvious_difference");
  assert.equal(comparisons.find((item) => item.metric === "comprehensionScore")?.status, "obvious_difference");
});

test("9.9 个百分点及 0.49 分不属于明显差异", () => {
  const left = comparablePerformance("v1", 0.401, 3.21);
  const right = comparablePerformance("v2", 0.5, 3.7);
  const comparisons = compareVersionPerformance(left, right);

  assert.equal(comparisons.find((item) => item.metric === "completionRate")?.status, "no_obvious_difference");
  assert.equal(comparisons.find((item) => item.metric === "comprehensionScore")?.status, "no_obvious_difference");
});

test("跨渠道只可并列展示，不产生胜负", () => {
  const left = comparablePerformance("v1", 0.4, 3.2);
  const right = { ...comparablePerformance("v2", 0.8, 4.5), channel: "douyin" as const };
  const comparisons = compareVersionPerformance(left, right);

  assert.ok(comparisons.every((item) => item.status === "not_comparable" && item.reason === "cross_channel"));
  assert.ok(comparisons.every((item) => item.winnerVersionId === undefined));
});

test("建议规则覆盖理解度和 CTA 的 10 个百分点边界，且最多五条", () => {
  const performance = comparablePerformance("v2", 0.6, 3.49);
  performance.ctaPerformance = [
    { ctaId: "a", label: "A", startMs: 10, endMs: 20, reachedSessions: 30, impressionSessions: 30, clickSessions: 9, consultationSessions: 0, exposureRate: metric(1), clickRate: metric(0.3), consultationRate: metric(0) },
    { ctaId: "b", label: "B", startMs: 20, endMs: 30, reachedSessions: 30, impressionSessions: 30, clickSessions: 6, consultationSessions: 0, exposureRate: metric(1), clickRate: metric(0.2), consultationRate: metric(0) },
    { ctaId: "c", label: "C", startMs: 30, endMs: 40, reachedSessions: 30, impressionSessions: 30, clickSessions: 3, consultationSessions: 0, exposureRate: metric(1), clickRate: metric(0.1), consultationRate: metric(0) }
  ];
  const obviousComparisons = Array.from({ length: 6 }, (_, index) => ({
    metric: "completionRate" as const,
    status: "obvious_difference" as const,
    leftVersionId: `old-${index}`,
    rightVersionId: "v2",
    leftValue: 0.4,
    rightValue: 0.6,
    delta: 0.2,
    unit: "percentage_point" as const,
    threshold: 0.1,
    winnerVersionId: "v2"
  }));

  const recommendations = generateOptimizationBrief({ performance, comparisons: obviousComparisons });

  assert.ok(recommendations.some((item) => item.conclusion.includes("理解度")));
  assert.ok(recommendations.some((item) => item.conclusion.includes("领先同版本其他 CTA")));
  assert.ok(recommendations.some((item) => item.conclusion.includes("低于同版本 CTA 中位数")));
  assert.equal(recommendations.length, 5);
  assert.ok(recommendations.every((item) => item.evidence.length > 0 && item.dataPrecision && item.recommendedAction));
});

test("样本不足时只建议继续收集样本，不给出强结论", () => {
  const performance = comparablePerformance("v1", 0.9, 2, 29);
  const recommendations = generateOptimizationBrief({ performance });

  assert.equal(recommendations.length, 1);
  assert.match(recommendations[0].conclusion, /样本不足/);
  assert.match(recommendations[0].recommendedAction, /至少 30/);
});
