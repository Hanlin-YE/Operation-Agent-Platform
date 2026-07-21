import { createHash } from "crypto";
import {
  AssetReference,
  ChannelPublication,
  ContentOperationsData,
  ContentSeries,
  PlatformMetricKey,
  PlatformMetrics,
  VideoCta,
  VideoVersion,
  ViewerEvent,
  ViewerFeedback,
} from "./types";

const createdAt = "2026-07-13T00:00:00.000Z";
const metricKeys: PlatformMetricKey[] = [
  "views",
  "likes",
  "comments",
  "shares",
  "reposts",
  "downloads",
  "averageWatchDurationMs",
  "coins",
  "favorites",
  "danmaku",
];

const contentSeries: ContentSeries[] = [
  {
    id: "series_demo_coreless_motor",
    name: "[演示] 空心杯电机原理科普",
    businessGoal: "比较不同视频版本的理解、互动与协作者入口表现。",
    createdAt,
    updatedAt: "2026-07-14T00:00:00.000Z",
  },
];

const videoVersions: VideoVersion[] = [
  {
    id: "version_demo_v1",
    seriesId: contentSeries[0].id,
    versionNumber: "v1",
    durationMs: 92_000,
    publishedAt: "2026-07-12T02:00:00.000Z",
    status: "published",
    title: "[演示] 空心杯电机原理科普 v1",
    batch: "2026-07-12",
    publishedBy: "运营-演示",
    approvedBy: "技术负责人",
    createdAt,
    updatedAt: createdAt,
  },
  {
    id: "version_demo_v2",
    seriesId: contentSeries[0].id,
    versionNumber: "v2",
    durationMs: 88_000,
    publishedAt: "2026-07-13T02:00:00.000Z",
    status: "published",
    title: "[演示] 空心杯电机原理科普 v2",
    batch: "2026-07-13",
    publishedBy: "运营-演示",
    approvedBy: "技术负责人",
    createdAt: "2026-07-13T01:00:00.000Z",
    updatedAt: "2026-07-13T01:00:00.000Z",
  },
];

const assetReferences: AssetReference[] = videoVersions.flatMap((version) =>
  (["script", "storyboard", "prompt", "video"] as const).map((assetType) => ({
    id: `asset_${version.versionNumber}_${assetType}`,
    videoVersionId: version.id,
    assetType,
    assetVersion: `${version.versionNumber}.0`,
    referenceUrl: `https://example.invalid/content-operations/${version.versionNumber}/${assetType}`,
    summary: `[演示引用] ${version.versionNumber} ${assetType} 的外部版本记录，不包含原始资产。`,
    createdAt: version.createdAt,
    updatedAt: version.updatedAt,
  })),
);

const ctas: VideoCta[] = [
  {
    id: "cta_demo_v1_tech",
    videoVersionId: videoVersions[0].id,
    startMs: 42_000,
    endMs: 55_000,
    label: "向技术答疑协作者提问",
    targetAgentId: "collab_tech",
    targetUrl: "https://example.invalid/agents/technical-consultation",
    priority: 1,
    createdAt,
    updatedAt: createdAt,
  },
  {
    id: "cta_demo_v2_tech",
    videoVersionId: videoVersions[1].id,
    startMs: 36_000,
    endMs: 49_000,
    label: "继续了解技术方案",
    targetAgentId: "collab_tech",
    targetUrl: "https://example.invalid/agents/technical-consultation",
    priority: 1,
    createdAt,
    updatedAt: createdAt,
  },
];

const channelPublications: ChannelPublication[] = videoVersions.flatMap((version) =>
  (["web", "douyin", "bilibili"] as const).map((channel) => ({
    id: `publication_${version.versionNumber}_${channel}`,
    videoVersionId: version.id,
    channel,
    platformVideoId: `${channel}_demo_${version.versionNumber}`,
    publicationUrl: `https://example.invalid/${channel}/${version.versionNumber}`,
    publishedAt: version.publishedAt!,
    createdAt: version.createdAt,
    updatedAt: version.updatedAt,
  })),
);

function sessionHash(versionNumber: string, index: number) {
  return createHash("sha256").update(`content-operations-seed:${versionNumber}:${index}`).digest("hex");
}

function eventTime(versionIndex: number, sessionIndex: number, offsetSeconds: number) {
  const time = Date.UTC(2026, 6, 14 + versionIndex, 2, sessionIndex, offsetSeconds);
  return new Date(time).toISOString();
}

function makeWebSeed(version: VideoVersion, versionIndex: number, sessionCount: number, feedbackCount: number) {
  const versionCta = ctas.find((cta) => cta.videoVersionId === version.id)!;
  const publication = channelPublications.find(
    (item) => item.videoVersionId === version.id && item.channel === "web",
  )!;
  const events: ViewerEvent[] = [];
  const feedback: ViewerFeedback[] = [];

  for (let index = 1; index <= sessionCount; index += 1) {
    const hash = sessionHash(version.versionNumber, index);
    const eventPrefix = `event_seed_${version.versionNumber}_${String(index).padStart(2, "0")}`;
    events.push({
      id: `${eventPrefix}_start`,
      eventName: "play_start",
      occurredAt: eventTime(versionIndex, index, 0),
      videoVersionId: version.id,
      publicationId: publication.id,
      channel: "web",
      sessionHash: hash,
      schemaVersion: 1,
      positionMs: 0,
    });

    const progressThresholds = [25, 50, 75, 90, 100].filter((threshold) => {
      if (threshold <= 50) return true;
      const completionBias = version.versionNumber === "v2" ? 4 : 9;
      if (threshold === 75) return index % 7 !== 0;
      if (threshold === 90) return index % completionBias !== 0 && index % 5 !== 0;
      return index % completionBias !== 0 && index % 4 !== 0;
    });
    for (const threshold of progressThresholds) {
      events.push({
        id: `${eventPrefix}_progress_${threshold}`,
        eventName: "play_progress",
        occurredAt: eventTime(versionIndex, index, threshold),
        videoVersionId: version.id,
        publicationId: publication.id,
        channel: "web",
        sessionHash: hash,
        schemaVersion: 1,
        positionMs: Math.round(version.durationMs * threshold / 100),
        progressPercent: threshold,
      });
    }

    events.push({
      id: `${eventPrefix}_impression`,
      eventName: "cta_impression",
      occurredAt: eventTime(versionIndex, index, 51),
      videoVersionId: version.id,
      publicationId: publication.id,
      channel: "web",
      sessionHash: hash,
      schemaVersion: 1,
      ctaId: versionCta.id,
      positionMs: versionCta.startMs + 1_000,
    });
    const clickEvery = version.versionNumber === "v2" ? 3 : 7;
    if (index % clickEvery === 0) {
      events.push({
        id: `${eventPrefix}_cta_click`,
        eventName: "cta_click",
        occurredAt: eventTime(versionIndex, index, 53),
        videoVersionId: version.id,
        publicationId: publication.id,
        channel: "web",
        sessionHash: hash,
        schemaVersion: 1,
        ctaId: versionCta.id,
        targetAgentId: versionCta.targetAgentId,
        positionMs: versionCta.startMs + 3_000,
      });
    }
    if (index % (clickEvery * 2) === 0) {
      events.push({
        id: `${eventPrefix}_consultation`,
        eventName: "consultation_click",
        occurredAt: eventTime(versionIndex, index, 54),
        videoVersionId: version.id,
        publicationId: publication.id,
        channel: "web",
        sessionHash: hash,
        schemaVersion: 1,
        ctaId: versionCta.id,
        targetAgentId: versionCta.targetAgentId,
        positionMs: versionCta.startMs + 4_000,
      });
    }

    if (index <= feedbackCount) {
      const feedbackId = `feedback_seed_${version.versionNumber}_${String(index).padStart(2, "0")}`;
      const baseScore = version.versionNumber === "v2" ? 4 : 3;
      const occurredAt = eventTime(versionIndex, index, 58);
      feedback.push({
        id: feedbackId,
        videoVersionId: version.id,
        sessionHash: hash,
        comprehensionScore: Math.min(5, baseScore + (index % 4 === 0 ? 1 : 0)),
        interestScore: Math.min(5, baseScore + (index % 3 === 0 ? 1 : 0)),
        trustScore: Math.min(5, baseScore + (index % 5 === 0 ? 1 : 0)),
        comment: index % 8 === 0 ? "术语解释可以更直白。" : null,
        positionMs: index % 8 === 0 ? versionCta.startMs : null,
        occurredAt,
        updatedAt: occurredAt,
      });
      events.push({
        id: `${eventPrefix}_feedback`,
        eventName: "feedback_submit",
        occurredAt,
        videoVersionId: version.id,
        publicationId: publication.id,
        channel: "web",
        sessionHash: hash,
        schemaVersion: 1,
        feedbackId,
        positionMs: index % 8 === 0 ? versionCta.startMs : undefined,
      });
    }
  }

  return { events, feedback };
}

function unavailableMetrics(): PlatformMetrics {
  return Object.fromEntries(metricKeys.map((key) => [key, "unavailable"])) as PlatformMetrics;
}

function dailyMetrics(channel: "douyin" | "bilibili", versionNumber: string, dayIndex: number) {
  const multiplier = versionNumber === "v2" ? 1.28 : 1;
  const views = Math.round((760 + dayIndex * 45) * multiplier);
  const common = {
    ...unavailableMetrics(),
    views,
    likes: Math.round(views * (versionNumber === "v2" ? 0.072 : 0.058)),
    comments: Math.round(views * 0.012),
    shares: Math.round(views * (versionNumber === "v2" ? 0.022 : 0.015)),
    averageWatchDurationMs: versionNumber === "v2" ? 51_000 + dayIndex * 300 : 43_000 + dayIndex * 250,
  } satisfies PlatformMetrics;

  if (channel === "douyin") {
    return {
      ...common,
      reposts: Math.round(views * 0.006),
      downloads: dayIndex % 2 === 0 ? Math.round(views * 0.003) : "unavailable",
    } satisfies PlatformMetrics;
  }
  return {
    ...common,
    coins: Math.round(views * 0.009),
    favorites: Math.round(views * 0.018),
    danmaku: Math.round(views * 0.007),
  } satisfies PlatformMetrics;
}

const platformMetricSnapshots = channelPublications
  .filter((publication) => publication.channel !== "web")
  .flatMap((publication) => {
    const version = videoVersions.find((item) => item.id === publication.videoVersionId)!;
    return Array.from({ length: 14 }, (_, dayIndex) => {
      const day = 7 + dayIndex;
      const metricDate = `2026-07-${String(day).padStart(2, "0")}`;
      const syncedAt = `${metricDate}T23:30:00.000Z`;
      return {
        id: `snapshot_${publication.id}_${metricDate}`,
        publicationId: publication.id,
        channel: publication.channel as "douyin" | "bilibili",
        platformVideoId: publication.platformVideoId,
        metricDate,
        syncedAt,
        precision: "video_or_daily" as const,
        source: "demo_seed" as const,
        metricMode: "daily" as const,
        metrics: dailyMetrics(publication.channel as "douyin" | "bilibili", version.versionNumber, dayIndex),
        syncStatus: "success" as const,
        errorSummary: null,
        createdAt: syncedAt,
      };
    });
  });

const v1Web = makeWebSeed(videoVersions[0], 0, 36, 32);
const v2Web = makeWebSeed(videoVersions[1], 1, 42, 36);

export const seedContentOperationsData: ContentOperationsData = {
  schemaVersion: 1,
  contentSeries,
  videoVersions,
  assetReferences,
  ctas,
  channelPublications,
  viewerEvents: [...v1Web.events, ...v2Web.events],
  viewerFeedback: [...v1Web.feedback, ...v2Web.feedback],
  platformMetricSnapshots,
};
