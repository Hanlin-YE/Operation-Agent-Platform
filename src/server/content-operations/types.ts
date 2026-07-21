export type ContentChannel = "web" | "douyin" | "bilibili";
export type PlatformChannel = Exclude<ContentChannel, "web">;
export type VideoVersionStatus = "draft" | "published" | "archived";
export type AssetReferenceType = "script" | "storyboard" | "prompt" | "video";
export type PlatformMetricValue = number | "unavailable";
export type PlatformMetricMode = "daily" | "cumulative";
export type PlatformMetricSource = "official_api" | "manual_entry" | "demo_seed";
export type PlatformMetricSyncStatus = "success" | "failed";

export type ContentSeries = {
  id: string;
  name: string;
  businessGoal: string;
  createdAt: string;
  updatedAt: string;
};

export type VideoVersion = {
  id: string;
  seriesId: string;
  versionNumber: string;
  durationMs: number;
  publishedAt: string | null;
  /** 草稿阶段的内容排期；实际发布后以 publishedAt 为准。 */
  plannedPublishAt?: string | null;
  status: VideoVersionStatus;
  // 发布台账字段（Phase A 引入，可选）
  title: string | null;          // 内容标题，缺省由展示层 fallback 系列名+版本号
  batch: string | null;          // 批次
  registeredBy?: string | null;  // 登记人
  publishedBy: string | null;    // 发布人
  approvedBy: string | null;     // 审批人
  createdAt: string;
  updatedAt: string;
};

export type AssetReference = {
  id: string;
  videoVersionId: string;
  assetType: AssetReferenceType;
  assetVersion: string;
  referenceUrl: string;
  summary: string;
  createdAt: string;
  updatedAt: string;
};

export type VideoCta = {
  id: string;
  videoVersionId: string;
  startMs: number;
  endMs: number;
  label: string;
  targetAgentId: string;
  targetUrl: string;
  priority: number;
  createdAt: string;
  updatedAt: string;
};

export type ChannelPublication = {
  id: string;
  videoVersionId: string;
  channel: ContentChannel;
  platformVideoId: string;
  publicationUrl: string;
  publishedAt: string;
  createdAt: string;
  updatedAt: string;
};

export type ViewerEventName =
  | "play_start"
  | "play_progress"
  | "cta_impression"
  | "cta_click"
  | "consultation_click"
  | "feedback_submit";

export type ViewerEvent = {
  id: string;
  eventName: ViewerEventName;
  occurredAt: string;
  videoVersionId: string;
  publicationId?: string;
  channel: "web";
  sessionHash: string;
  schemaVersion: 1;
  positionMs?: number;
  progressPercent?: number;
  progressTrigger?: "threshold" | "page_close";
  ctaId?: string;
  targetAgentId?: string;
  feedbackId?: string;
};

export type ViewerFeedback = {
  id: string;
  videoVersionId: string;
  sessionHash: string;
  comprehensionScore: number;
  interestScore: number;
  trustScore: number;
  comment: string | null;
  positionMs: number | null;
  occurredAt: string;
  updatedAt: string;
};

export type PlatformMetricKey =
  | "views"
  | "likes"
  | "comments"
  | "shares"
  | "reposts"
  | "downloads"
  | "averageWatchDurationMs"
  | "coins"
  | "favorites"
  | "danmaku";

export type PlatformMetrics = Record<PlatformMetricKey, PlatformMetricValue>;

export type PlatformMetricSnapshot = {
  id: string;
  publicationId: string;
  channel: PlatformChannel;
  platformVideoId: string;
  metricDate: string;
  syncedAt: string;
  precision: "video_or_daily";
  source: PlatformMetricSource;
  metricMode: PlatformMetricMode;
  metrics: PlatformMetrics;
  syncStatus?: PlatformMetricSyncStatus;
  errorSummary?: string | null;
  createdAt: string;
};

export type ContentOperationsData = {
  schemaVersion: 1;
  contentSeries: ContentSeries[];
  videoVersions: VideoVersion[];
  assetReferences: AssetReference[];
  ctas: VideoCta[];
  channelPublications: ChannelPublication[];
  viewerEvents: ViewerEvent[];
  viewerFeedback: ViewerFeedback[];
  platformMetricSnapshots: PlatformMetricSnapshot[];
};

export type ContentOperationsStorageInfo = {
  mode: "file" | "memory";
  durable: boolean;
  warning: string | null;
};
