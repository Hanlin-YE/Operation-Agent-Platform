import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import {
  ContentOperationsRepositoryError,
  appendPlatformMetricSnapshot,
  configureVideoCta,
  recordViewerEvent,
  registerVideoVersion,
} from "@/server/content-operations/repository";
import {
  calculateChannelPerformances,
  compareVersionPerformance,
  deriveAvailableMetricWindow,
  generateOptimizationBrief,
  VersionPerformance,
} from "@/server/content-operations/performance";
import { getContentOperationsCatalog } from "@/server/content-operations/repository";
import { getContentOperationsStorageInfo } from "@/server/content-operations/store";
import { ContentChannel, ContentOperationsData, PlatformMetricKey } from "@/server/content-operations/types";

const channelSchema = z.enum(["web", "douyin", "bilibili"]);
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "must use YYYY-MM-DD");
const metricValueSchema = z.union([z.number().int().nonnegative(), z.literal("unavailable")]);
const platformMetricKeys: PlatformMetricKey[] = [
  "views", "likes", "comments", "shares", "reposts", "downloads",
  "averageWatchDurationMs", "coins", "favorites", "danmaku",
];

const comparisonMetricKeys: Record<string, string> = {
  completionRate: "completion_rate",
  ctaExposureRate: "cta_exposure_rate",
  ctaClickRate: "cta_click_rate",
  consultationRate: "consultation_rate",
  comprehensionScore: "comprehension_score",
  interestScore: "interest_score",
  trustScore: "trust_score",
  platformEngagementRate: "platform_engagement_rate",
};

const queryShape = {
  series_id: z.string().min(1).optional(),
  video_version_ids: z.array(z.string().min(1)).max(2).optional(),
  channel: channelSchema,
  from: dateSchema.optional(),
  to: dateSchema.optional(),
};

type QueryInput = {
  series_id?: string;
  video_version_ids?: string[];
  channel: ContentChannel;
  from?: string;
  to?: string;
};

type QueryResult = {
  data: ContentOperationsData;
  seriesId: string;
  versions: ContentOperationsData["videoVersions"];
  performances: VersionPerformance[];
  comparisons: Array<ReturnType<typeof compareVersionPerformance>[number]>;
  window: { from: string; to: string };
};

function toolResult(payload: Record<string, unknown>) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(payload) }],
    structuredContent: payload,
  };
}

function toolError(error: unknown): Error {
  if (error instanceof ContentOperationsRepositoryError) {
    return new Error(`${error.code}: ${error.message}`);
  }
  if (error instanceof Error) return new Error(error.message);
  return new Error("content operations tool failed");
}

async function safeTool<T extends Record<string, unknown>>(action: () => Promise<T>) {
  try {
    return toolResult(await action());
  } catch (error) {
    throw toolError(error);
  }
}

function isValidDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
    && new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value;
}

function selectVersions(data: ContentOperationsData, input: QueryInput, seriesId: string) {
  const publicationVersionIds = new Set(
    data.channelPublications
      .filter((publication) => publication.channel === input.channel)
      .map((publication) => publication.videoVersionId),
  );
  const requested = new Set(input.video_version_ids || []);
  const versions = data.videoVersions.filter((version) =>
    version.seriesId === seriesId
    && version.status === "published"
    && publicationVersionIds.has(version.id)
    && (!requested.size || requested.has(version.id)),
  );
  if (input.video_version_ids?.length) {
    const order = new Map(input.video_version_ids.map((id, index) => [id, index]));
    return versions.sort((left, right) => (order.get(left.id) ?? 0) - (order.get(right.id) ?? 0));
  }
  return versions.sort((left, right) => (left.publishedAt || left.createdAt).localeCompare(right.publishedAt || right.createdAt));
}

async function queryPerformance(input: QueryInput): Promise<QueryResult> {
  const data = await getContentOperationsCatalog();
  const seriesId = input.series_id || data.contentSeries[0]?.id || "";
  const series = data.contentSeries.find((item) => item.id === seriesId);
  if (!series) throw new Error("content series not found");
  const versions = selectVersions(data, input, seriesId);
  const availableWindow = deriveAvailableMetricWindow({
    data,
    versionIds: versions.map((version) => version.id),
    channel: input.channel,
  });
  const today = new Date().toISOString().slice(0, 10);
  const window = {
    from: input.from || availableWindow?.from || today,
    to: input.to || availableWindow?.to || today,
  };
  if (!isValidDate(window.from) || !isValidDate(window.to)) throw new Error("from and to must use valid YYYY-MM-DD dates");
  if (window.from > window.to) throw new Error("from must not be later than to");
  const performances = calculateChannelPerformances({ data, versions, channel: input.channel, window });
  const comparisons = performances.flatMap((left, index) =>
    performances.slice(index + 1).flatMap((right) => compareVersionPerformance(left, right)),
  );
  return { data, seriesId, versions, performances, comparisons, window };
}

function metricResult(metric: {
  value: number | null;
  status: string;
  numerator?: number;
  denominator?: number;
  sampleSize?: number;
  dataGaps: Array<{ message: string }>;
}) {
  return {
    value: metric.value,
    status: metric.status,
    numerator: metric.numerator,
    denominator: metric.denominator,
    sample_size: metric.sampleSize,
    data_gaps: metric.dataGaps.map((item) => item.message),
  };
}

function performanceResult(performance: VersionPerformance) {
  return {
    video_version_id: performance.version.videoVersionId,
    series_id: performance.seriesId,
    version_number: performance.version.versionNumber,
    channel: performance.channel,
    metric_window: performance.window,
    source_precision: performance.precision,
    sample_size: performance.sampleSize,
    eligibility: performance.eligibility,
    metrics: {
      unique_view_sessions: performance.metrics.uniqueViewSessions,
      completion_rate: metricResult(performance.metrics.completionRate),
      cta_exposure_rate: metricResult(performance.metrics.ctaExposureRate),
      cta_click_rate: metricResult(performance.metrics.ctaClickRate),
      consultation_rate: metricResult(performance.metrics.consultationRate),
      comprehension_score: metricResult(performance.metrics.comprehensionScore),
      interest_score: metricResult(performance.metrics.interestScore),
      trust_score: metricResult(performance.metrics.trustScore),
      platform_engagement_rate: metricResult(performance.metrics.platformEngagementRate),
      platform_views: metricResult(performance.metrics.platformViews),
    },
    cta_performance: performance.ctaPerformance.map((cta) => ({
      cta_id: cta.ctaId,
      label: cta.label,
      start_ms: cta.startMs,
      end_ms: cta.endMs,
      reached_sessions: cta.reachedSessions,
      impression_sessions: cta.impressionSessions,
      click_sessions: cta.clickSessions,
      consultation_sessions: cta.consultationSessions,
      exposure_rate: metricResult(cta.exposureRate),
      click_rate: metricResult(cta.clickRate),
      consultation_rate: metricResult(cta.consultationRate),
    })),
    data_gaps: performance.dataGaps.map((item) => item.message),
  };
}

function comparisonResult(comparison: ReturnType<typeof compareVersionPerformance>[number]) {
  return {
    metric: comparisonMetricKeys[comparison.metric] || comparison.metric,
    status: comparison.status,
    left_version_id: comparison.leftVersionId,
    right_version_id: comparison.rightVersionId,
    left_value: comparison.leftValue,
    right_value: comparison.rightValue,
    delta: comparison.delta,
    unit: comparison.unit,
    threshold: comparison.threshold,
    winner_version_id: comparison.winnerVersionId,
    reason: comparison.reason,
  };
}

function queryPayload(result: QueryResult) {
  return {
    series_id: result.seriesId,
    channel: result.performances[0]?.channel || null,
    metric_window: result.window,
    source_precision: [...new Set(result.performances.map((item) => item.precision))],
    sample_size: result.performances.map((item) => ({ video_version_id: item.version.videoVersionId, value: item.sampleSize, eligibility: item.eligibility })),
    metrics: result.performances.map(performanceResult),
    comparison: result.comparisons.map(comparisonResult),
    data_gaps: [...new Set(result.performances.flatMap((item) => item.dataGaps.map((gap) => `${item.version.versionNumber}：${gap.message}`)))],
    storage: getContentOperationsStorageInfo(),
  };
}

function recommendationMatchesTarget(conclusion: string, target: "understanding" | "interest" | "trust" | "cta" | "all") {
  if (target === "all") return true;
  if (target === "understanding") return conclusion.includes("理解度");
  if (target === "interest") return conclusion.includes("兴趣度");
  if (target === "trust") return conclusion.includes("信任度");
  return conclusion.includes("CTA") || conclusion.includes("咨询");
}

export function createContentOperationsMcpServer() {
  const server = new McpServer({ name: "content-operations", version: "0.1.0" });

  server.registerTool("register_video_version", {
    description: "Register a published or draft video version under an existing content series.",
    inputSchema: {
      series_id: z.string().min(1),
      version_number: z.string().min(1).max(32),
      duration_ms: z.number().int().positive(),
      status: z.enum(["draft", "published", "archived"]).default("draft"),
      published_at: z.string().datetime().nullable().optional(),
      asset_references: z.array(z.object({
        asset_type: z.enum(["script", "storyboard", "prompt", "video"]),
        asset_version: z.string().min(1).max(64),
        reference_url: z.string().url(),
        summary: z.string().min(1).max(200),
      })).optional(),
      ctas: z.array(z.object({
        start_ms: z.number().int().nonnegative(),
        end_ms: z.number().int().positive(),
        label: z.string().min(1).max(100),
        target_agent_id: z.string().min(1).max(128),
        target_url: z.string().url(),
        priority: z.number().int().nonnegative(),
      })).optional(),
    },
  }, async (args) => safeTool(async () => {
    const result = await registerVideoVersion({
      seriesId: args.series_id,
      versionNumber: args.version_number,
      durationMs: args.duration_ms,
      status: args.status,
      publishedAt: args.published_at,
      assetReferences: args.asset_references?.map((asset) => ({
        assetType: asset.asset_type,
        assetVersion: asset.asset_version,
        referenceUrl: asset.reference_url,
        summary: asset.summary,
      })),
      ctas: args.ctas?.map((cta) => ({
        startMs: cta.start_ms,
        endMs: cta.end_ms,
        label: cta.label,
        targetAgentId: cta.target_agent_id,
        targetUrl: cta.target_url,
        priority: cta.priority,
      })),
    });
    return {
      video_version_id: result.version.id,
      validation: { status: "accepted", asset_count: result.assetReferences.length, cta_count: result.ctas.length },
    };
  }));

  server.registerTool("configure_video_cta", {
    description: "Configure a CTA interval and its collaborating agent target for a video version.",
    inputSchema: {
      video_version_id: z.string().min(1),
      start_ms: z.number().int().nonnegative(),
      end_ms: z.number().int().positive(),
      label: z.string().min(1).max(100),
      target_agent_id: z.string().min(1).max(128),
      target_url: z.string().url(),
      priority: z.number().int().nonnegative(),
    },
  }, async (args) => safeTool(async () => {
    const result = await configureVideoCta(args.video_version_id, {
      startMs: args.start_ms,
      endMs: args.end_ms,
      label: args.label,
      targetAgentId: args.target_agent_id,
      targetUrl: args.target_url,
      priority: args.priority,
    });
    return { cta_id: result.cta.id, overlapping_cta_ids: result.overlappingCtaIds, validation: { status: "accepted" } };
  }));

  server.registerTool("record_web_event", {
    description: "Record one validated first-party web video event. The server assigns occurred_at and stores only a session hash.",
    inputSchema: {
      event_id: z.string().min(1).max(160),
      event_name: z.enum(["play_start", "play_progress", "cta_impression", "cta_click", "consultation_click"]),
      video_version_id: z.string().min(1),
      publication_id: z.string().min(1).optional(),
      session_id: z.string().min(8).max(256),
      position_ms: z.number().int().nonnegative(),
      progress_percent: z.number().int().min(0).max(100).optional(),
      progress_trigger: z.enum(["threshold", "page_close"]).optional(),
      cta_id: z.string().min(1).optional(),
      target_agent_id: z.string().min(1).max(128).optional(),
    },
  }, async (args) => safeTool(async () => {
    const event = await recordViewerEvent({
      eventId: args.event_id,
      eventName: args.event_name,
      videoVersionId: args.video_version_id,
      publicationId: args.publication_id,
      sessionId: args.session_id,
      positionMs: args.position_ms,
      progressPercent: args.progress_percent,
      progressTrigger: args.progress_trigger,
      ctaId: args.cta_id,
      targetAgentId: args.target_agent_id,
    });
    return { accepted: true, event_id: event.id, occurred_at: event.occurredAt };
  }));

  server.registerTool("sync_platform_metrics", {
    description: "Append one manually supplied platform metric snapshot. Official account adapters are not connected in this slice, so the result is explicitly marked manual_entry.",
    inputSchema: {
      publication_id: z.string().min(1),
      metric_date: dateSchema,
      synced_at: z.string().datetime().optional(),
      metric_mode: z.enum(["daily", "cumulative"]),
      sync_status: z.enum(["success", "failed"]).default("success"),
      error_summary: z.string().max(500).nullable().optional(),
      metrics: z.record(z.string(), metricValueSchema).optional(),
    },
  }, async (args) => safeTool(async () => {
    const snapshot = await appendPlatformMetricSnapshot(args.publication_id, {
      metricDate: args.metric_date,
      syncedAt: args.synced_at,
      metricMode: args.metric_mode,
      syncStatus: args.sync_status,
      errorSummary: args.error_summary,
      metrics: args.metrics as Partial<Record<PlatformMetricKey, number | "unavailable">> | undefined,
      source: "manual_entry",
    });
    const unavailableFields = platformMetricKeys.filter((key) => snapshot.metrics[key] === "unavailable");
    return {
      sync_batch_id: null,
      status: snapshot.syncStatus === "failed" ? "failed" : "manual_entry_recorded",
      source: snapshot.source,
      snapshot_count: 1,
      unavailable_fields: unavailableFields,
      error_summary: snapshot.errorSummary,
      snapshot_id: snapshot.id,
    };
  }));

  server.registerTool("query_video_performance", {
    description: "Compare published video versions within one series, channel, and metric window using the content operations rules.",
    inputSchema: queryShape,
  }, async (args) => safeTool(async () => queryPayload(await queryPerformance(args))));

  server.registerTool("generate_optimization_brief", {
    description: "Generate up to five evidence-backed optimization recommendations from the same-channel performance query.",
    inputSchema: {
      ...queryShape,
      target: z.enum(["understanding", "interest", "trust", "cta", "all"]).default("all"),
    },
  }, async (args) => safeTool(async () => {
    const result = await queryPerformance(args);
    const recommendations = result.performances.flatMap((performance) => generateOptimizationBrief({
      performance,
      comparisons: result.comparisons.filter((comparison) =>
        comparison.leftVersionId === performance.version.videoVersionId || comparison.rightVersionId === performance.version.videoVersionId,
      ),
    })).filter((recommendation) => recommendationMatchesTarget(recommendation.conclusion, args.target)).slice(0, 5);
    return {
      series_id: result.seriesId,
      channel: args.channel,
      metric_window: result.window,
      target: args.target,
      recommendations: recommendations.map((recommendation) => ({
        conclusion: recommendation.conclusion,
        evidence: recommendation.evidence,
        data_precision: recommendation.dataPrecision,
        confidence: recommendation.confidence,
        recommended_action: recommendation.recommendedAction,
      })),
      data_gaps: [...new Set(result.performances.flatMap((item) => item.dataGaps.map((gap) => gap.message)))],
    };
  }));

  return server;
}
