import type {
  ChannelPublication,
  ContentChannel as DomainContentChannel,
  ContentOperationsData,
  PlatformMetricMode,
  PlatformMetricSource,
  PlatformMetricSnapshot,
  VideoCta,
  VideoVersion
} from "./types";

export const MIN_WEB_SAMPLE_SIZE = 30;
export const MIN_PLATFORM_TREND_DAYS = 7;
export const RATIO_DIFFERENCE_THRESHOLD = 0.1;
export const SCORE_DIFFERENCE_THRESHOLD = 0.5;

export type ContentChannel = DomainContentChannel;
export type MetricMode = PlatformMetricMode;
export type MetricValue = number | "unavailable";

export type MetricWindow = {
  from: string;
  to: string;
};

export type MetricGapCode =
  | "zero_denominator"
  | "no_feedback"
  | "no_cta"
  | "unavailable_field"
  | "sync_failed"
  | "missing_snapshot"
  | "missing_cumulative_baseline"
  | "mixed_metric_mode"
  | "counter_reset"
  | "inconsistent_events";

export type MetricGap = {
  code: MetricGapCode;
  message: string;
  field?: string;
  date?: string;
};

export type MetricResult = {
  value: number | null;
  status: "available" | "unavailable";
  numerator?: number;
  denominator?: number;
  sampleSize?: number;
  dataGaps: MetricGap[];
};

export type PerformanceVersion = {
  videoVersionId: string;
  seriesId: string;
  versionNumber: string;
  status: string;
  publishedAt?: string | null;
};

export type PerformanceCta = {
  ctaId: string;
  videoVersionId: string;
  label: string;
  startMs: number;
  endMs: number;
};

export type PerformanceWebEvent = {
  eventId?: string;
  eventName:
    | "play_start"
    | "play_progress"
    | "cta_impression"
    | "cta_click"
    | "consultation_click"
    | "feedback_submit";
  videoVersionId: string;
  channel: "web";
  sessionHash: string;
  occurredAt: string;
  positionMs?: number;
  progressPercent?: number;
  ctaId?: string;
};

export type PerformanceFeedback = {
  feedbackId?: string;
  videoVersionId: string;
  sessionHash: string;
  occurredAt: string;
  updatedAt?: string;
  comprehensionScore: number;
  interestScore: number;
  trustScore: number;
};

export type PlatformMetricField =
  | "views"
  | "likes"
  | "comments"
  | "shares"
  | "reposts"
  | "downloads"
  | "coins"
  | "favorites"
  | "danmaku";

export type PerformancePlatformSnapshot = {
  snapshotId?: string;
  videoVersionId: string;
  channel: Exclude<ContentChannel, "web">;
  metricDate: string;
  syncedAt: string;
  metricMode: MetricMode;
  metrics: Partial<Record<PlatformMetricField, MetricValue>>;
  syncStatus?: "success" | "failed";
  source?: PlatformMetricSource;
};

export function toPerformanceVersion(version: VideoVersion): PerformanceVersion {
  return {
    videoVersionId: version.id,
    seriesId: version.seriesId,
    versionNumber: version.versionNumber,
    status: version.status,
    publishedAt: version.publishedAt
  };
}

export function toPerformanceCta(cta: VideoCta): PerformanceCta {
  return {
    ctaId: cta.id,
    videoVersionId: cta.videoVersionId,
    label: cta.label,
    startMs: cta.startMs,
    endMs: cta.endMs
  };
}

export function toPerformancePlatformSnapshots(
  snapshots: readonly PlatformMetricSnapshot[],
  publications: readonly ChannelPublication[]
): PerformancePlatformSnapshot[] {
  const publicationById = new Map(publications.map((publication) => [publication.id, publication]));
  return snapshots.flatMap((snapshot) => {
    const publication = publicationById.get(snapshot.publicationId);
    if (!publication || publication.channel === "web") return [];
    return [{
      snapshotId: snapshot.id,
      videoVersionId: publication.videoVersionId,
      channel: snapshot.channel,
      metricDate: snapshot.metricDate,
      syncedAt: snapshot.syncedAt,
      metricMode: snapshot.metricMode,
      metrics: snapshot.metrics,
      syncStatus: snapshot.syncStatus || "success",
      source: snapshot.source
    }];
  });
}

export type CtaPerformance = {
  ctaId: string;
  label: string;
  startMs: number;
  endMs: number;
  reachedSessions: number;
  impressionSessions: number;
  clickSessions: number;
  consultationSessions: number;
  exposureRate: MetricResult;
  clickRate: MetricResult;
  consultationRate: MetricResult;
};

export type PerformanceMetrics = {
  uniqueViewSessions: number;
  completionRate: MetricResult;
  ctaExposureRate: MetricResult;
  ctaClickRate: MetricResult;
  consultationRate: MetricResult;
  comprehensionScore: MetricResult;
  interestScore: MetricResult;
  trustScore: MetricResult;
  platformEngagementRate: MetricResult;
  platformViews: MetricResult;
};

export type PlatformCoverage = {
  expectedDates: string[];
  observedDates: string[];
  missingDates: string[];
  syncFailedDates: string[];
  unavailableFields: string[];
  consecutiveDays: number;
  eligibleForTrend: boolean;
};

export type PerformanceEligibility = "valid" | "sample_insufficient" | "trend_insufficient" | "data_gap";

export type VersionPerformance = {
  version: PerformanceVersion;
  seriesId: string;
  channel: ContentChannel;
  window: MetricWindow;
  sampleSize: number;
  precision: string;
  eligibility: PerformanceEligibility;
  metrics: PerformanceMetrics;
  ctaPerformance: CtaPerformance[];
  platformCoverage?: PlatformCoverage;
  dataGaps: MetricGap[];
};

export type ComparisonMetricKey =
  | "completionRate"
  | "ctaExposureRate"
  | "ctaClickRate"
  | "consultationRate"
  | "comprehensionScore"
  | "interestScore"
  | "trustScore"
  | "platformEngagementRate";

export type MetricComparison = {
  metric: ComparisonMetricKey;
  status: "obvious_difference" | "no_obvious_difference" | "not_comparable" | "observation_only";
  leftVersionId: string;
  rightVersionId: string;
  leftValue: number | null;
  rightValue: number | null;
  delta: number | null;
  unit: "percentage_point" | "score";
  threshold: number;
  winnerVersionId?: string;
  reason?: string;
};

export type OptimizationRecommendation = {
  conclusion: string;
  evidence: string[];
  dataPrecision: string;
  confidence: "low" | "medium" | "high";
  recommendedAction: string;
};

const ratioMetricKeys = new Set<ComparisonMetricKey>([
  "completionRate",
  "ctaExposureRate",
  "ctaClickRate",
  "consultationRate",
  "platformEngagementRate"
]);

const comparisonMetricKeys: ComparisonMetricKey[] = [
  "completionRate",
  "ctaExposureRate",
  "ctaClickRate",
  "consultationRate",
  "comprehensionScore",
  "interestScore",
  "trustScore",
  "platformEngagementRate"
];

const comparisonMetricLabels: Record<ComparisonMetricKey, string> = {
  completionRate: "完播率",
  ctaExposureRate: "CTA 曝光率",
  ctaClickRate: "CTA 点击率",
  consultationRate: "咨询入口率",
  comprehensionScore: "理解度",
  interestScore: "兴趣度",
  trustScore: "信任度",
  platformEngagementRate: "平台互动率"
};

const platformInteractionFields: Record<Exclude<ContentChannel, "web">, PlatformMetricField[]> = {
  douyin: ["likes", "comments", "shares", "reposts", "downloads"],
  bilibili: ["likes", "comments", "shares", "coins", "favorites", "danmaku"]
};

function gap(code: MetricGapCode, message: string, detail: Pick<MetricGap, "field" | "date"> = {}): MetricGap {
  return { code, message, ...detail };
}

function unavailableMetric(dataGaps: MetricGap[], counts: Partial<Pick<MetricResult, "numerator" | "denominator" | "sampleSize">> = {}): MetricResult {
  return { value: null, status: "unavailable", dataGaps, ...counts };
}

export function calculateRate(numerator: number, denominator: number): MetricResult {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || numerator < 0 || denominator < 0) {
    return unavailableMetric([gap("inconsistent_events", "指标计数不是有效的非负数。")], { numerator, denominator });
  }
  if (denominator === 0) {
    return unavailableMetric([gap("zero_denominator", "指标分母为零，不能以零代替缺失值。")], { numerator, denominator });
  }
  return { value: numerator / denominator, status: "available", numerator, denominator, dataGaps: [] };
}

export function calculateAverage(values: readonly number[]): MetricResult {
  const validValues = values.filter((value) => Number.isFinite(value));
  if (validValues.length === 0) {
    return unavailableMetric([gap("no_feedback", "统计窗口内没有可用反馈。")], { sampleSize: 0 });
  }
  return {
    value: validValues.reduce((sum, value) => sum + value, 0) / validValues.length,
    status: "available",
    sampleSize: validValues.length,
    dataGaps: []
  };
}

function emptyMetric(code: MetricGapCode, message: string): MetricResult {
  return unavailableMetric([gap(code, message)]);
}

function emptyMetrics(): PerformanceMetrics {
  return {
    uniqueViewSessions: 0,
    completionRate: emptyMetric("zero_denominator", "没有独立观看会话。"),
    ctaExposureRate: emptyMetric("no_cta", "没有可计算的 CTA。"),
    ctaClickRate: emptyMetric("no_cta", "没有可计算的 CTA。"),
    consultationRate: emptyMetric("no_cta", "没有可计算的 CTA。"),
    comprehensionScore: emptyMetric("no_feedback", "没有理解度反馈。"),
    interestScore: emptyMetric("no_feedback", "没有兴趣度反馈。"),
    trustScore: emptyMetric("no_feedback", "没有信任度反馈。"),
    platformEngagementRate: emptyMetric("unavailable_field", "该渠道不适用平台互动率。"),
    platformViews: emptyMetric("unavailable_field", "该渠道没有平台播放量。")
  };
}

function metricResults(metrics: PerformanceMetrics): MetricResult[] {
  return [
    metrics.completionRate,
    metrics.ctaExposureRate,
    metrics.ctaClickRate,
    metrics.consultationRate,
    metrics.comprehensionScore,
    metrics.interestScore,
    metrics.trustScore,
    metrics.platformEngagementRate,
    metrics.platformViews
  ];
}

function parseBoundary(value: string, endBoundary: boolean): number {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const start = Date.parse(`${value}T00:00:00.000Z`);
    return endBoundary ? start + 86_400_000 - 1 : start;
  }
  return Date.parse(value);
}

function isInWindow(value: string, window: MetricWindow): boolean {
  const timestamp = Date.parse(value);
  const from = parseBoundary(window.from, false);
  const to = parseBoundary(window.to, true);
  return Number.isFinite(timestamp) && Number.isFinite(from) && Number.isFinite(to) && timestamp >= from && timestamp <= to;
}

function windowKey(window: MetricWindow): string {
  return `${parseBoundary(window.from, false)}:${parseBoundary(window.to, true)}`;
}

function unique<T>(items: readonly T[]): T[] {
  return [...new Set(items)];
}

function mergeGaps(metrics: readonly MetricResult[], additional: readonly MetricGap[] = []): MetricGap[] {
  const byKey = new Map<string, MetricGap>();
  for (const item of [...metrics.flatMap((metric) => metric.dataGaps), ...additional]) {
    byKey.set(`${item.code}:${item.field || ""}:${item.date || ""}:${item.message}`, item);
  }
  return [...byKey.values()];
}

function latestFeedbackBySession(feedback: readonly PerformanceFeedback[]): PerformanceFeedback[] {
  const latest = new Map<string, PerformanceFeedback>();
  for (const item of feedback) {
    const existing = latest.get(item.sessionHash);
    const currentTime = Date.parse(item.updatedAt || item.occurredAt);
    const existingTime = existing ? Date.parse(existing.updatedAt || existing.occurredAt) : -Infinity;
    if (!existing || currentTime >= existingTime) latest.set(item.sessionHash, item);
  }
  return [...latest.values()];
}

function markInconsistentRatio(metric: MetricResult, message: string): MetricResult {
  if (metric.numerator === undefined || metric.denominator === undefined || metric.numerator <= metric.denominator) return metric;
  return unavailableMetric([gap("inconsistent_events", message)], {
    numerator: metric.numerator,
    denominator: metric.denominator
  });
}

export function calculateWebPerformance(input: {
  version: PerformanceVersion;
  window: MetricWindow;
  events: readonly PerformanceWebEvent[];
  ctas: readonly PerformanceCta[];
  feedback: readonly PerformanceFeedback[];
}): VersionPerformance {
  const { version, window } = input;
  const events = input.events.filter(
    (event) => event.videoVersionId === version.videoVersionId && event.channel === "web" && isInWindow(event.occurredAt, window)
  );
  const ctas = input.ctas.filter((cta) => cta.videoVersionId === version.videoVersionId);
  const feedback = latestFeedbackBySession(
    input.feedback.filter(
      (item) => item.videoVersionId === version.videoVersionId && isInWindow(item.updatedAt || item.occurredAt, window)
    )
  );

  const playSessions = new Set(events.filter((event) => event.eventName === "play_start").map((event) => event.sessionHash));
  const completedSessions = new Set(
    events
      .filter(
        (event) =>
          event.eventName === "play_progress" &&
          (event.progressPercent || 0) >= 90 &&
          playSessions.has(event.sessionHash)
      )
      .map((event) => event.sessionHash)
  );
  const completionRate = calculateRate(completedSessions.size, playSessions.size);

  const maxPositionBySession = new Map<string, number>();
  for (const event of events) {
    if (!playSessions.has(event.sessionHash) || event.positionMs === undefined) continue;
    maxPositionBySession.set(event.sessionHash, Math.max(maxPositionBySession.get(event.sessionHash) || 0, event.positionMs));
  }

  const overallReached = new Set<string>();
  const overallImpressions = new Set<string>();
  const overallClicks = new Set<string>();
  const overallConsultations = new Set<string>();

  const ctaPerformance = ctas.map((cta): CtaPerformance => {
    const reached = new Set(
      [...playSessions].filter((sessionHash) => (maxPositionBySession.get(sessionHash) || 0) >= cta.startMs)
    );
    const impressions = new Set(
      events
        .filter(
          (event) => event.eventName === "cta_impression" && event.ctaId === cta.ctaId && playSessions.has(event.sessionHash)
        )
        .map((event) => event.sessionHash)
    );
    const clicks = new Set(
      events
        .filter((event) => event.eventName === "cta_click" && event.ctaId === cta.ctaId && playSessions.has(event.sessionHash))
        .map((event) => event.sessionHash)
    );
    const consultations = new Set(
      events
        .filter(
          (event) => event.eventName === "consultation_click" && event.ctaId === cta.ctaId && playSessions.has(event.sessionHash)
        )
        .map((event) => event.sessionHash)
    );

    reached.forEach((sessionHash) => overallReached.add(sessionHash));
    impressions.forEach((sessionHash) => overallImpressions.add(sessionHash));
    clicks.forEach((sessionHash) => overallClicks.add(sessionHash));
    consultations.forEach((sessionHash) => overallConsultations.add(sessionHash));

    return {
      ctaId: cta.ctaId,
      label: cta.label,
      startMs: cta.startMs,
      endMs: cta.endMs,
      reachedSessions: reached.size,
      impressionSessions: impressions.size,
      clickSessions: clicks.size,
      consultationSessions: consultations.size,
      exposureRate: markInconsistentRatio(
        calculateRate(impressions.size, reached.size),
        "CTA 曝光会话超过到达 CTA 开始位置的会话。"
      ),
      clickRate: markInconsistentRatio(calculateRate(clicks.size, impressions.size), "CTA 点击会话超过曝光会话。"),
      consultationRate: markInconsistentRatio(
        calculateRate(consultations.size, impressions.size),
        "咨询入口会话超过 CTA 曝光会话。"
      )
    };
  });

  const noCtaMetric = emptyMetric("no_cta", "该版本没有配置 CTA。率指标不可用。");
  const ctaExposureRate = ctas.length
    ? markInconsistentRatio(calculateRate(overallImpressions.size, overallReached.size), "CTA 曝光会话超过到达会话。")
    : noCtaMetric;
  const ctaClickRate = ctas.length
    ? markInconsistentRatio(calculateRate(overallClicks.size, overallImpressions.size), "CTA 点击会话超过曝光会话。")
    : noCtaMetric;
  const consultationRate = ctas.length
    ? markInconsistentRatio(
        calculateRate(overallConsultations.size, overallImpressions.size),
        "咨询入口会话超过 CTA 曝光会话。"
      )
    : noCtaMetric;

  const comprehensionScore = calculateAverage(feedback.map((item) => item.comprehensionScore));
  const interestScore = calculateAverage(feedback.map((item) => item.interestScore));
  const trustScore = calculateAverage(feedback.map((item) => item.trustScore));
  const notApplicablePlatform = emptyMetric("unavailable_field", "网页渠道不适用平台互动率。");
  const metrics: PerformanceMetrics = {
    uniqueViewSessions: playSessions.size,
    completionRate,
    ctaExposureRate,
    ctaClickRate,
    consultationRate,
    comprehensionScore,
    interestScore,
    trustScore,
    platformEngagementRate: notApplicablePlatform,
    platformViews: emptyMetric("unavailable_field", "网页渠道没有平台播放量。")
  };

  return {
    version,
    seriesId: version.seriesId,
    channel: "web",
    window,
    sampleSize: playSessions.size,
    precision: "网页端，毫秒级精确事件",
    eligibility: playSessions.size >= MIN_WEB_SAMPLE_SIZE ? "valid" : "sample_insufficient",
    metrics,
    ctaPerformance,
    dataGaps: mergeGaps([
      completionRate,
      ctaExposureRate,
      ctaClickRate,
      consultationRate,
      comprehensionScore,
      interestScore,
      trustScore
    ])
  };
}

function isoDate(value: string): string {
  return value.slice(0, 10);
}

function enumerateDates(window: MetricWindow): string[] {
  const from = Date.parse(`${isoDate(window.from)}T00:00:00.000Z`);
  const to = Date.parse(`${isoDate(window.to)}T00:00:00.000Z`);
  if (!Number.isFinite(from) || !Number.isFinite(to) || from > to) return [];
  const dates: string[] = [];
  for (let cursor = from; cursor <= to; cursor += 86_400_000) dates.push(new Date(cursor).toISOString().slice(0, 10));
  return dates;
}

function longestConsecutiveDateRun(dates: readonly string[]): number {
  const sorted = unique(dates).sort();
  let longest = 0;
  let current = 0;
  let previous: number | null = null;
  for (const date of sorted) {
    const value = Date.parse(`${date}T00:00:00.000Z`);
    current = previous !== null && value - previous === 86_400_000 ? current + 1 : 1;
    longest = Math.max(longest, current);
    previous = value;
  }
  return longest;
}

export function assessPlatformCoverage(input: {
  window: MetricWindow;
  observedMetricDates: readonly string[];
  syncFailedDates?: readonly string[];
  unavailableFields?: readonly string[];
}): PlatformCoverage {
  const expectedDates = enumerateDates(input.window);
  const observedDates = unique(input.observedMetricDates.map(isoDate)).sort();
  const observedSet = new Set(observedDates);
  const missingDates = expectedDates.filter((date) => !observedSet.has(date));
  const syncFailedDates = unique((input.syncFailedDates || []).map(isoDate)).sort();
  const unavailableFields = unique(input.unavailableFields || []).sort();
  const consecutiveDays = longestConsecutiveDateRun(observedDates.filter((date) => expectedDates.includes(date)));
  return {
    expectedDates,
    observedDates,
    missingDates,
    syncFailedDates,
    unavailableFields,
    consecutiveDays,
    eligibleForTrend:
      consecutiveDays >= MIN_PLATFORM_TREND_DAYS &&
      missingDates.length === 0 &&
      syncFailedDates.length === 0 &&
      unavailableFields.length === 0
  };
}

function latestSnapshotPerDate(snapshots: readonly PerformancePlatformSnapshot[]): PerformancePlatformSnapshot[] {
  const latest = new Map<string, PerformancePlatformSnapshot>();
  for (const snapshot of snapshots) {
    const existing = latest.get(snapshot.metricDate);
    if (!existing || Date.parse(snapshot.syncedAt) >= Date.parse(existing.syncedAt)) latest.set(snapshot.metricDate, snapshot);
  }
  return [...latest.values()].sort((left, right) => left.metricDate.localeCompare(right.metricDate));
}

function metricFromSnapshot(snapshot: PerformancePlatformSnapshot | undefined, field: PlatformMetricField): MetricValue {
  return snapshot?.metrics[field] ?? "unavailable";
}

function sumDailyField(
  snapshots: readonly PerformancePlatformSnapshot[],
  field: PlatformMetricField,
  dataGaps: MetricGap[]
): number | null {
  if (!snapshots.length) return null;
  let total = 0;
  for (const snapshot of snapshots) {
    const value = metricFromSnapshot(snapshot, field);
    if (value === "unavailable") {
      dataGaps.push(gap("unavailable_field", `${field} 在 ${snapshot.metricDate} 不可用。`, { field, date: snapshot.metricDate }));
      return null;
    }
    total += value;
  }
  return total;
}

function cumulativeFieldDelta(
  baseline: PerformancePlatformSnapshot | undefined,
  ending: PerformancePlatformSnapshot | undefined,
  field: PlatformMetricField,
  dataGaps: MetricGap[]
): number | null {
  if (!baseline) {
    dataGaps.push(gap("missing_cumulative_baseline", "累计指标缺少统计窗口开始前的基线快照。", { field }));
    return null;
  }
  if (!ending) {
    dataGaps.push(gap("missing_snapshot", "累计指标缺少统计窗口结束快照。", { field }));
    return null;
  }
  const startValue = metricFromSnapshot(baseline, field);
  const endValue = metricFromSnapshot(ending, field);
  if (startValue === "unavailable" || endValue === "unavailable") {
    dataGaps.push(gap("unavailable_field", `${field} 的累计窗口端点不可用。`, { field }));
    return null;
  }
  if (endValue < startValue) {
    dataGaps.push(gap("counter_reset", `${field} 的累计值在窗口内发生回退。`, { field }));
    return null;
  }
  return endValue - startValue;
}

export function calculatePlatformInteractionRate(input: {
  views: number | "unavailable" | null;
  allowedInteractionFields: readonly PlatformMetricField[];
  counts: Partial<Record<PlatformMetricField, number | "unavailable" | null>>;
}): MetricResult {
  const dataGaps: MetricGap[] = [];
  if (input.views === "unavailable" || input.views === null) {
    dataGaps.push(gap("unavailable_field", "平台播放量不可用。", { field: "views" }));
  }
  let interactions = 0;
  for (const field of input.allowedInteractionFields) {
    const value = input.counts[field];
    if (value === undefined || value === "unavailable" || value === null) {
      dataGaps.push(gap("unavailable_field", `${field} 不可用，不能以零补齐。`, { field }));
    } else {
      interactions += value;
    }
  }
  if (dataGaps.length || typeof input.views !== "number") {
    return unavailableMetric(dataGaps, { numerator: interactions, denominator: typeof input.views === "number" ? input.views : undefined });
  }
  return calculateRate(interactions, input.views);
}

export function calculatePlatformPerformance(input: {
  version: PerformanceVersion;
  channel: Exclude<ContentChannel, "web">;
  window: MetricWindow;
  snapshots: readonly PerformancePlatformSnapshot[];
}): VersionPerformance {
  const { version, channel, window } = input;
  const versionSnapshots = input.snapshots.filter(
    (snapshot) => snapshot.videoVersionId === version.videoVersionId && snapshot.channel === channel
  );
  const latestAttempts = latestSnapshotPerDate(versionSnapshots);
  const successful = latestAttempts.filter((snapshot) => snapshot.syncStatus !== "failed");
  const withinWindow = successful.filter((snapshot) => {
    const date = isoDate(snapshot.metricDate);
    return date >= isoDate(window.from) && date <= isoDate(window.to);
  });
  const failedDates = latestAttempts
    .filter((snapshot) => snapshot.syncStatus === "failed" && isoDate(snapshot.metricDate) >= isoDate(window.from) && isoDate(snapshot.metricDate) <= isoDate(window.to))
    .map((snapshot) => snapshot.metricDate);
  const metricMode = withinWindow[0]?.metricMode || successful[0]?.metricMode || "daily";
  const fields: PlatformMetricField[] = ["views", ...platformInteractionFields[channel]];
  const counts: Partial<Record<PlatformMetricField, number | null>> = {};
  const calculationGaps: MetricGap[] = [];
  const metricModes = unique(withinWindow.map((snapshot) => snapshot.metricMode));

  if (metricModes.length > 1) {
    calculationGaps.push(gap("mixed_metric_mode", "统计窗口内混用了 daily 与 cumulative 平台快照，不能计算比较指标。"));
    for (const field of fields) counts[field] = null;
  } else if (metricMode === "daily") {
    for (const field of fields) counts[field] = sumDailyField(withinWindow, field, calculationGaps);
  } else {
    const fromDate = isoDate(window.from);
    const baselineDate = new Date(Date.parse(`${fromDate}T00:00:00.000Z`) - 86_400_000).toISOString().slice(0, 10);
    const baseline = successful.find(
      (snapshot) => isoDate(snapshot.metricDate) === baselineDate && snapshot.metricMode === "cumulative"
    );
    const ending = withinWindow.at(-1);
    for (const field of fields) counts[field] = cumulativeFieldDelta(baseline, ending, field, calculationGaps);
  }

  const unavailableFields = unique(calculationGaps.filter((item) => item.field).map((item) => item.field as string));
  const coverage = assessPlatformCoverage({
    window,
    observedMetricDates: withinWindow.map((snapshot) => snapshot.metricDate),
    syncFailedDates: failedDates,
    unavailableFields
  });
  const coverageGaps: MetricGap[] = [
    ...coverage.missingDates.map((date) => gap("missing_snapshot", `缺少 ${date} 的平台快照。`, { date })),
    ...coverage.syncFailedDates.map((date) => gap("sync_failed", `${date} 的平台同步失败。`, { date }))
  ];
  const interactionRate = calculatePlatformInteractionRate({
    views: counts.views ?? null,
    allowedInteractionFields: platformInteractionFields[channel],
    counts
  });
  const platformViews = typeof counts.views === "number"
    ? { value: counts.views, status: "available" as const, sampleSize: counts.views, dataGaps: [] }
    : unavailableMetric(calculationGaps.filter((item) => item.field === "views"));
  const notApplicable = emptyMetric("unavailable_field", "平台渠道不适用网页精确指标。");
  const metrics: PerformanceMetrics = {
    ...emptyMetrics(),
    completionRate: notApplicable,
    ctaExposureRate: notApplicable,
    ctaClickRate: notApplicable,
    consultationRate: notApplicable,
    comprehensionScore: notApplicable,
    interestScore: notApplicable,
    trustScore: notApplicable,
    platformEngagementRate: interactionRate,
    platformViews
  };
  const dataGaps = mergeGaps([interactionRate, platformViews], [...calculationGaps, ...coverageGaps]);
  const sources = unique(withinWindow.map((snapshot) => snapshot.source || "official_api"));
  const precision = sources.includes("demo_seed")
    ? "演示种子，平台视频/日级"
    : sources.includes("manual_entry")
      ? "人工录入，平台视频/日级"
      : "平台视频/日级官方数据";
  const eligibility: PerformanceEligibility = dataGaps.some((item) =>
    ["unavailable_field", "sync_failed", "missing_snapshot", "missing_cumulative_baseline", "mixed_metric_mode", "counter_reset"].includes(item.code)
  )
    ? "data_gap"
    : coverage.consecutiveDays < MIN_PLATFORM_TREND_DAYS
      ? "trend_insufficient"
      : "valid";

  return {
    version,
    seriesId: version.seriesId,
    channel,
    window,
    sampleSize: typeof counts.views === "number" ? counts.views : 0,
    precision,
    eligibility,
    metrics,
    ctaPerformance: [],
    platformCoverage: coverage,
    dataGaps
  };
}

export function calculateChannelPerformances(input: {
  data: ContentOperationsData;
  versions: readonly VideoVersion[];
  channel: ContentChannel;
  window: MetricWindow;
}): VersionPerformance[] {
  const { data, versions, channel, window } = input;
  if (channel === "web") {
    return versions.map((version) => calculateWebPerformance({
      version: toPerformanceVersion(version),
      window,
      events: data.viewerEvents,
      ctas: data.ctas.map(toPerformanceCta),
      feedback: data.viewerFeedback
    }));
  }
  const snapshots = toPerformancePlatformSnapshots(data.platformMetricSnapshots, data.channelPublications);
  return versions.map((version) => calculatePlatformPerformance({
    version: toPerformanceVersion(version),
    channel,
    window,
    snapshots
  }));
}

export function deriveAvailableMetricWindow(input: {
  data: ContentOperationsData;
  versionIds: readonly string[];
  channel: ContentChannel;
}): MetricWindow | null {
  const versionIds = new Set(input.versionIds);
  let dates: string[];
  if (input.channel === "web") {
    dates = input.data.viewerEvents
      .filter((event) => versionIds.has(event.videoVersionId))
      .map((event) => isoDate(event.occurredAt));
  } else {
    const publicationIds = new Set(
      input.data.channelPublications
        .filter((publication) => versionIds.has(publication.videoVersionId) && publication.channel === input.channel)
        .map((publication) => publication.id)
    );
    dates = input.data.platformMetricSnapshots
      .filter((snapshot) => publicationIds.has(snapshot.publicationId))
      .map((snapshot) => isoDate(snapshot.metricDate));
  }
  const sorted = unique(dates).sort();
  return sorted.length ? { from: sorted[0], to: sorted.at(-1) as string } : null;
}

function contextFailure(left: VersionPerformance, right: VersionPerformance): string | null {
  if (left.seriesId !== right.seriesId) return "different_series";
  if (left.channel !== right.channel) return "cross_channel";
  if (windowKey(left.window) !== windowKey(right.window)) return "different_window";
  if (left.version.status !== "published" || right.version.status !== "published") return "unpublished_version";
  if (left.version.videoVersionId === right.version.videoVersionId) return "same_version";
  return null;
}

function comparisonForMetric(
  left: VersionPerformance,
  right: VersionPerformance,
  metric: ComparisonMetricKey,
  contextReason: string | null
): MetricComparison {
  const leftMetric = left.metrics[metric];
  const rightMetric = right.metrics[metric];
  const ratio = ratioMetricKeys.has(metric);
  const threshold = ratio ? RATIO_DIFFERENCE_THRESHOLD : SCORE_DIFFERENCE_THRESHOLD;
  const base = {
    metric,
    leftVersionId: left.version.videoVersionId,
    rightVersionId: right.version.videoVersionId,
    leftValue: leftMetric.value,
    rightValue: rightMetric.value,
    unit: ratio ? "percentage_point" as const : "score" as const,
    threshold
  };
  if (contextReason) return { ...base, status: "not_comparable", delta: null, reason: contextReason };
  if (leftMetric.status === "unavailable" || rightMetric.status === "unavailable") {
    return { ...base, status: "not_comparable", delta: null, reason: "data_gap" };
  }
  const leftValue = leftMetric.value as number;
  const rightValue = rightMetric.value as number;
  const delta = rightValue - leftValue;
  if (left.channel === "web" && (left.sampleSize < MIN_WEB_SAMPLE_SIZE || right.sampleSize < MIN_WEB_SAMPLE_SIZE)) {
    return { ...base, status: "observation_only", delta, reason: "sample_insufficient" };
  }
  if (left.channel !== "web" && (left.eligibility !== "valid" || right.eligibility !== "valid")) {
    return {
      ...base,
      status: "not_comparable",
      delta: null,
      reason: left.eligibility === "trend_insufficient" || right.eligibility === "trend_insufficient"
        ? "platform_trend_insufficient"
        : "data_gap"
    };
  }
  const obvious = Math.abs(delta) + 1e-12 >= threshold;
  return {
    ...base,
    status: obvious ? "obvious_difference" : "no_obvious_difference",
    delta,
    ...(obvious ? { winnerVersionId: delta > 0 ? right.version.videoVersionId : left.version.videoVersionId } : {})
  };
}

export function compareVersionPerformance(left: VersionPerformance, right: VersionPerformance): MetricComparison[] {
  const reason = contextFailure(left, right);
  return comparisonMetricKeys.map((metric) => comparisonForMetric(left, right, metric, reason));
}

function median(values: readonly number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1).replace(/\.0$/, "")}%`;
}

export function generateOptimizationBrief(input: {
  performance: VersionPerformance;
  comparisons?: readonly MetricComparison[];
}): OptimizationRecommendation[] {
  const { performance } = input;
  if (performance.channel === "web" && performance.sampleSize < MIN_WEB_SAMPLE_SIZE) {
    return [{
      conclusion: `当前仅有 ${performance.sampleSize} 个独立观看会话，样本不足，仅供观察。`,
      evidence: [
        `独立观看会话=${performance.sampleSize}`,
        `最小有效样本=${MIN_WEB_SAMPLE_SIZE}`,
        `统计窗口=${performance.window.from} 至 ${performance.window.to}`
      ],
      dataPrecision: performance.precision,
      confidence: "low",
      recommendedAction: `继续收集至至少 ${MIN_WEB_SAMPLE_SIZE} 个独立观看会话，再判断版本或内容优劣。`
    }];
  }
  if (performance.eligibility !== "valid") return [];

  const recommendations: OptimizationRecommendation[] = [];
  const comprehension = performance.metrics.comprehensionScore;
  if (comprehension.value !== null && comprehension.value < 3.5) {
    recommendations.push({
      conclusion: `${performance.version.versionNumber} 的理解度为 ${comprehension.value.toFixed(1)}/5，低于 3.5。`,
      evidence: [
        `comprehension_score=${comprehension.value.toFixed(1)}/5`,
        `反馈样本=${comprehension.sampleSize || 0}`,
        `统计窗口=${performance.window.from} 至 ${performance.window.to}`
      ],
      dataPrecision: performance.precision,
      confidence: "medium",
      recommendedAction: "优先简化术语解释，并用对比画面或具体结果补充该片段。"
    });
  }

  const validCtas = performance.ctaPerformance.filter(
    (cta) => cta.clickRate.value !== null && cta.impressionSessions > 0
  );
  const sortedCtas = [...validCtas].sort((left, right) => (right.clickRate.value as number) - (left.clickRate.value as number));
  if (sortedCtas.length >= 2) {
    const lead = (sortedCtas[0].clickRate.value as number) - (sortedCtas[1].clickRate.value as number);
    if (lead + 1e-12 >= RATIO_DIFFERENCE_THRESHOLD) {
      const best = sortedCtas[0];
      recommendations.push({
        conclusion: `CTA“${best.label}”点击率领先同版本其他 CTA 至少 10 个百分点。`,
        evidence: [
          `cta_click_rate=${formatPercent(best.clickRate.value as number)}`,
          `次高 CTA=${formatPercent(sortedCtas[1].clickRate.value as number)}`,
          `曝光会话=${best.impressionSessions}`
        ],
        dataPrecision: performance.precision,
        confidence: "medium",
        recommendedAction: "保留该 CTA，并在下一版测试适度前移展示时间。"
      });
    }
  }

  const ctaMedian = median(validCtas.map((cta) => cta.clickRate.value as number));
  if (ctaMedian !== null) {
    for (const cta of validCtas) {
      if (ctaMedian - (cta.clickRate.value as number) + 1e-12 < RATIO_DIFFERENCE_THRESHOLD) continue;
      recommendations.push({
        conclusion: `CTA“${cta.label}”有曝光，但点击率低于同版本 CTA 中位数至少 10 个百分点。`,
        evidence: [
          `cta_click_rate=${formatPercent(cta.clickRate.value as number)}`,
          `同版本 CTA 中位数=${formatPercent(ctaMedian)}`,
          `曝光会话=${cta.impressionSessions}`
        ],
        dataPrecision: performance.precision,
        confidence: "medium",
        recommendedAction: "更换 CTA 文案、展示位置或目标协作者，并在下一版本继续对照测试。"
      });
    }
  }

  for (const comparison of input.comparisons || []) {
    if (comparison.status !== "obvious_difference" || comparison.winnerVersionId !== performance.version.videoVersionId) continue;
    const value = performance.metrics[comparison.metric].value;
    recommendations.push({
      conclusion: `${performance.version.versionNumber} 的${comparisonMetricLabels[comparison.metric]}相比对照版本存在明显优势。`,
      evidence: [
        `${comparison.metric}=${value === null ? "unavailable" : ratioMetricKeys.has(comparison.metric) ? formatPercent(value) : value.toFixed(1)}`,
        `差异=${comparison.delta === null ? "unavailable" : ratioMetricKeys.has(comparison.metric) ? `${Math.abs(comparison.delta * 100).toFixed(1)} 个百分点` : `${Math.abs(comparison.delta).toFixed(1)} 分`}`,
        `统计窗口=${performance.window.from} 至 ${performance.window.to}`
      ],
      dataPrecision: performance.precision,
      confidence: "medium",
      recommendedAction: "保留形成优势的脚本与分镜要素，并在下一版本只改变一个待验证变量。"
    });
  }

  return recommendations.slice(0, 5);
}
