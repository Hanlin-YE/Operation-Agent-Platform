import { NextResponse } from "next/server";
import {
  calculateChannelPerformances,
  ContentChannel,
  deriveAvailableMetricWindow,
  VersionPerformance
} from "@/server/content-operations/performance";
import { getContentOperationsCatalog } from "@/server/content-operations/repository";
import { getContentOperationsStorageInfo } from "@/server/content-operations/store";
import { ContentOperationsData } from "@/server/content-operations/types";

function isDateOnly(value: string | null): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value;
}

function itemStatus(performance: VersionPerformance) {
  return performance.eligibility;
}

function groupForChannel(
  data: ContentOperationsData,
  channel: ContentChannel,
  seriesId: string | null,
  requestedWindow: { from: string | null; to: string | null }
) {
  const publicationByVersion = new Map(
    data.channelPublications
      .filter((publication) => publication.channel === channel)
      .map((publication) => [publication.videoVersionId, publication])
  );
  const versions = data.videoVersions.filter(
    (version) => version.status === "published" && (!seriesId || version.seriesId === seriesId) && publicationByVersion.has(version.id)
  );
  const availableWindow = deriveAvailableMetricWindow({ data, versionIds: versions.map((version) => version.id), channel });
  const today = new Date().toISOString().slice(0, 10);
  const window = {
    from: requestedWindow.from || availableWindow?.from || today,
    to: requestedWindow.to || availableWindow?.to || today
  };
  const performances = calculateChannelPerformances({ data, versions, channel, window });
  const seriesById = new Map(data.contentSeries.map((series) => [series.id, series]));
  const unsorted = performances.map((performance) => {
    const series = seriesById.get(performance.seriesId);
    const publication = publicationByVersion.get(performance.version.videoVersionId);
    const web = channel === "web";
    return {
      rank: 0,
      seriesId: performance.seriesId,
      seriesName: series?.name || "未知内容系列",
      videoVersionId: performance.version.videoVersionId,
      versionNumber: performance.version.versionNumber,
      publicationUrl: publication?.publicationUrl || null,
      primaryMetric: {
        key: web ? "completionRate" : "platformEngagementRate",
        label: web ? "完播率" : "平台互动率",
        value: web ? performance.metrics.completionRate.value : performance.metrics.platformEngagementRate.value
      },
      secondaryMetric: {
        key: web ? "ctaClickRate" : "views",
        label: web ? "CTA 点击率" : "播放量",
        value: web ? performance.metrics.ctaClickRate.value : performance.metrics.platformViews.value
      },
      sampleSize: performance.sampleSize,
      status: itemStatus(performance),
      dataGaps: performance.dataGaps.map((item) => item.message)
    };
  });
  const statusOrder = { valid: 0, sample_insufficient: 1, trend_insufficient: 2, data_gap: 3 };
  let validRank = 0;
  const items = unsorted
    .sort((left, right) => {
      const statusDifference = statusOrder[left.status] - statusOrder[right.status];
      if (statusDifference) return statusDifference;
      const leftValue = left.primaryMetric.value;
      const rightValue = right.primaryMetric.value;
      if (leftValue === null && rightValue !== null) return 1;
      if (leftValue !== null && rightValue === null) return -1;
      if (leftValue !== null && rightValue !== null && leftValue !== rightValue) return rightValue - leftValue;
      return left.versionNumber.localeCompare(right.versionNumber, "zh-CN", { numeric: true });
    })
    .map((item) => ({ ...item, rank: item.status === "valid" ? ++validRank : null }));
  return {
    channel,
    precision: [...new Set(performances.map((performance) => performance.precision))].join("；") || webPrecision(channel),
    items
  };
}

function webPrecision(channel: ContentChannel) {
  return channel === "web" ? "网页端，毫秒级精确事件" : "平台视频/日级官方数据";
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  if ((from && !isDateOnly(from)) || (to && !isDateOnly(to))) {
    return NextResponse.json({ error: "from and to must use YYYY-MM-DD" }, { status: 400 });
  }
  if (from && to && from > to) return NextResponse.json({ error: "from must not be later than to" }, { status: 400 });
  const data = await getContentOperationsCatalog();
  const seriesId = url.searchParams.get("seriesId");
  if (seriesId && !data.contentSeries.some((series) => series.id === seriesId)) {
    return NextResponse.json({ error: "content series not found" }, { status: 404 });
  }
  const groups = (["web", "douyin", "bilibili"] as const).map((channel) =>
    groupForChannel(data, channel, seriesId, { from, to })
  );
  const scopedVersionIds = new Set(
    data.videoVersions.filter((version) => !seriesId || version.seriesId === seriesId).map((version) => version.id)
  );
  const scopedPublicationIds = new Set(
    data.channelPublications.filter((publication) => scopedVersionIds.has(publication.videoVersionId)).map((publication) => publication.id)
  );
  const inRequestedWindow = (value: string) => (!from || value.slice(0, 10) >= from) && (!to || value.slice(0, 10) <= to);
  const dataAsOf = [
    ...data.viewerEvents.filter((event) => scopedVersionIds.has(event.videoVersionId) && inRequestedWindow(event.occurredAt)).map((event) => event.occurredAt),
    ...data.platformMetricSnapshots.filter((snapshot) => scopedPublicationIds.has(snapshot.publicationId) && inRequestedWindow(snapshot.metricDate)).map((snapshot) => snapshot.syncedAt)
  ].sort().at(-1) || null;

  return NextResponse.json({ groups, dataAsOf, storage: getContentOperationsStorageInfo() });
}
