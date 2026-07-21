import { NextResponse } from "next/server";
import {
  calculateChannelPerformances,
  compareVersionPerformance,
  ContentChannel,
  deriveAvailableMetricWindow,
  generateOptimizationBrief,
  MetricResult,
  VersionPerformance
} from "@/server/content-operations/performance";
import { getContentOperationsCatalog } from "@/server/content-operations/repository";
import { getContentOperationsStorageInfo } from "@/server/content-operations/store";
import { ContentOperationsData, VideoVersion } from "@/server/content-operations/types";

const channels = new Set<ContentChannel>(["web", "douyin", "bilibili"]);

function isDateOnly(value: string | null): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value;
}

function metricForApi(metric: MetricResult) {
  return { ...metric, dataGaps: metric.dataGaps.map((item) => item.message) };
}

function performanceForApi(performance: VersionPerformance) {
  return {
    ...performance,
    metrics: {
      uniqueViewSessions: performance.metrics.uniqueViewSessions,
      completionRate: metricForApi(performance.metrics.completionRate),
      ctaExposureRate: metricForApi(performance.metrics.ctaExposureRate),
      ctaClickRate: metricForApi(performance.metrics.ctaClickRate),
      consultationRate: metricForApi(performance.metrics.consultationRate),
      comprehensionScore: metricForApi(performance.metrics.comprehensionScore),
      interestScore: metricForApi(performance.metrics.interestScore),
      trustScore: metricForApi(performance.metrics.trustScore),
      platformEngagementRate: metricForApi(performance.metrics.platformEngagementRate),
      platformViews: metricForApi(performance.metrics.platformViews)
    },
    ctaPerformance: performance.ctaPerformance.map((cta) => ({
      ctaId: cta.ctaId,
      label: cta.label,
      startMs: cta.startMs,
      endMs: cta.endMs,
      reachedSessions: cta.reachedSessions,
      impressionSessions: cta.impressionSessions,
      clickSessions: cta.clickSessions,
      consultationSessions: cta.consultationSessions,
      exposureRate: cta.exposureRate.value,
      clickRate: cta.clickRate.value,
      consultationRate: cta.consultationRate.value,
      dataGaps: [cta.exposureRate, cta.clickRate, cta.consultationRate]
        .flatMap((metric) => metric.dataGaps.map((item) => item.message))
    })),
    dataGaps: performance.dataGaps.map((item) => item.message)
  };
}

function versionsForChannel(
  data: ContentOperationsData,
  seriesId: string,
  channel: ContentChannel,
  requestedVersionIds: readonly string[]
) {
  const publishedVersionIds = new Set(
    data.channelPublications.filter((publication) => publication.channel === channel).map((publication) => publication.videoVersionId)
  );
  const requested = new Set(requestedVersionIds);
  const versions = data.videoVersions.filter(
    (version) =>
      version.seriesId === seriesId &&
      version.status === "published" &&
      publishedVersionIds.has(version.id) &&
      (!requested.size || requested.has(version.id))
  );
  if (requestedVersionIds.length) {
    const order = new Map(requestedVersionIds.map((id, index) => [id, index]));
    return versions.sort((left, right) => (order.get(left.id) || 0) - (order.get(right.id) || 0));
  }
  return versions.sort((left, right) =>
    (left.publishedAt || left.createdAt).localeCompare(right.publishedAt || right.createdAt)
  );
}

function allComparisons(performances: readonly VersionPerformance[]) {
  return performances.flatMap((left, leftIndex) =>
    performances.slice(leftIndex + 1).flatMap((right) => compareVersionPerformance(left, right))
  );
}

function statusForChannel(
  data: ContentOperationsData,
  seriesId: string,
  versionIds: readonly string[],
  channel: ContentChannel,
  window: { from: string; to: string }
) {
  const channelVersions = versionsForChannel(data, seriesId, channel, versionIds);
  if (!channelVersions.length) {
    return { channel, precision: channel === "web" ? "网页端，毫秒级精确事件" : "平台视频/日级官方数据", status: "no_data", dataGaps: ["暂无可用数据"] };
  }
  const performances = calculateChannelPerformances({ data, versions: channelVersions, channel, window });
  const status = performances.some((item) => item.eligibility === "data_gap")
    ? "data_gap"
    : performances.some((item) => item.eligibility === "sample_insufficient")
      ? "sample_insufficient"
      : performances.some((item) => item.eligibility === "trend_insufficient")
        ? "trend_insufficient"
        : "valid";
  return {
    channel,
    precision: performances[0]?.precision || (channel === "web" ? "网页端，毫秒级精确事件" : "平台视频/日级官方数据"),
    status,
    dataGaps: [...new Set(performances.flatMap((item) => item.dataGaps.map((dataGap) => dataGap.message)))]
  };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const data = await getContentOperationsCatalog();
  const seriesId = url.searchParams.get("seriesId") || data.contentSeries[0]?.id || "";
  const channelValue = url.searchParams.get("channel") || "web";
  if (!channels.has(channelValue as ContentChannel)) {
    return NextResponse.json({ error: "channel must be web, douyin, or bilibili" }, { status: 400 });
  }
  const channel = channelValue as ContentChannel;
  const series = data.contentSeries.find((item) => item.id === seriesId);
  if (!series) return NextResponse.json({ error: "content series not found" }, { status: 404 });

  const requestedVersionIds = (url.searchParams.get("versionIds") || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const versions = versionsForChannel(data, seriesId, channel, requestedVersionIds);
  const availableWindow = deriveAvailableMetricWindow({ data, versionIds: versions.map((version) => version.id), channel });
  const fromParam = url.searchParams.get("from");
  const toParam = url.searchParams.get("to");
  if ((fromParam && !isDateOnly(fromParam)) || (toParam && !isDateOnly(toParam))) {
    return NextResponse.json({ error: "from and to must use YYYY-MM-DD" }, { status: 400 });
  }
  const today = new Date().toISOString().slice(0, 10);
  const window = {
    from: fromParam || availableWindow?.from || today,
    to: toParam || availableWindow?.to || today
  };
  if (window.from > window.to) return NextResponse.json({ error: "from must not be later than to" }, { status: 400 });

  const performances = calculateChannelPerformances({ data, versions, channel, window });
  const comparisons = allComparisons(performances);
  const recommendations = performances
    .flatMap((performance) => generateOptimizationBrief({
      performance,
      comparisons: comparisons.filter(
        (comparison) => comparison.leftVersionId === performance.version.videoVersionId || comparison.rightVersionId === performance.version.videoVersionId
      )
    }))
    .slice(0, 5);
  const dataGaps = [...new Set(
    performances.flatMap((performance) =>
      performance.dataGaps.map((dataGap) => `${performance.version.versionNumber}：${dataGap.message}`)
    )
  )];
  const statusVersionIds = requestedVersionIds.length
    ? requestedVersionIds
    : data.videoVersions.filter((version) => version.seriesId === seriesId && version.status === "published").map((version) => version.id);

  return NextResponse.json({
    query: { seriesId, channel, versionIds: versions.map((version) => version.id), ...window },
    series: { seriesId: series.id, name: series.name, businessGoal: series.businessGoal },
    performances: performances.map(performanceForApi),
    comparisons,
    recommendations,
    channelStatus: (["web", "douyin", "bilibili"] as const).map((item) => statusForChannel(data, seriesId, statusVersionIds, item, window)),
    dataGaps,
    storage: getContentOperationsStorageInfo()
  });
}
