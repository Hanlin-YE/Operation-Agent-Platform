import { createHmac, randomUUID } from "crypto";
import {
  AssetReference,
  AssetReferenceType,
  ChannelPublication,
  ContentChannel,
  ContentOperationsData,
  ContentSeries,
  PlatformMetricKey,
  PlatformMetricMode,
  PlatformMetricSnapshot,
  PlatformMetricSource,
  PlatformMetricSyncStatus,
  PlatformMetricValue,
  VideoCta,
  VideoVersion,
  VideoVersionStatus,
  ViewerEvent,
  ViewerEventName,
  ViewerFeedback,
} from "./types";
import {
  getContentOperationsStorageInfo,
  mutateContentOperationsData,
  readContentOperationsData,
} from "./store";

export type ContentOperationsErrorKind = "validation" | "not_found" | "conflict" | "configuration";

export class ContentOperationsRepositoryError extends Error {
  constructor(
    public readonly kind: ContentOperationsErrorKind,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ContentOperationsRepositoryError";
  }
}

export type AssetReferenceDraft = {
  assetType: AssetReferenceType;
  assetVersion: string;
  referenceUrl: string;
  summary: string;
};

export type VideoCtaDraft = {
  startMs: number;
  endMs: number;
  label: string;
  targetAgentId: string;
  targetUrl: string;
  priority: number;
};

export type ChannelPublicationDraft = {
  channel: ContentChannel;
  platformVideoId: string;
  publicationUrl: string;
  publishedAt: string;
};

export type RegisterVideoVersionInput = {
  seriesId: string;
  versionNumber: string;
  durationMs: number;
  publishedAt?: string | null;
  plannedPublishAt?: string | null;
  status?: VideoVersionStatus;
  assetReferences?: AssetReferenceDraft[];
  ctas?: VideoCtaDraft[];
  publications?: ChannelPublicationDraft[];
  // 发布台账字段（Phase A）
  title?: string | null;
  batch?: string | null;
  registeredBy?: string | null;
  publishedBy?: string | null;
  approvedBy?: string | null;
};

export type PublicationLedgerPatch = {
  title?: string | null;
  batch?: string | null;
  registeredBy?: string | null;
  publishedBy?: string | null;
  approvedBy?: string | null;
  status?: VideoVersionStatus;
  publishedAt?: string | null;
};

export type RegisteredVideoVersion = {
  version: VideoVersion;
  assetReferences: AssetReference[];
  ctas: VideoCta[];
  publications: ChannelPublication[];
};

export type CreateContentSeriesInput = {
  name: string;
  businessGoal: string;
  versions?: Array<Omit<RegisterVideoVersionInput, "seriesId">>;
};

export type CreatedContentSeries = {
  series: ContentSeries;
  versions: RegisteredVideoVersion[];
};

export type RecordViewerEventInput = {
  id?: string;
  eventId?: string;
  eventName: ViewerEventName;
  occurredAt?: string;
  videoVersionId: string;
  publicationId?: string;
  sessionId: string;
  positionMs?: number;
  progressPercent?: number;
  progressTrigger?: "threshold" | "page_close";
  ctaId?: string;
  targetAgentId?: string;
  feedbackId?: string;
};

export type SubmitViewerFeedbackInput = {
  videoVersionId: string;
  sessionId: string;
  comprehensionScore: number;
  interestScore: number;
  trustScore: number;
  comment?: string | null;
  positionMs?: number | null;
  occurredAt?: string;
};

export type AppendPlatformMetricSnapshotInput = {
  metricDate: string;
  syncedAt?: string;
  metricMode: PlatformMetricMode;
  metrics?: Partial<Record<PlatformMetricKey, PlatformMetricValue>>;
  syncStatus?: PlatformMetricSyncStatus;
  errorSummary?: string | null;
  source?: PlatformMetricSource;
};

const assetTypes = new Set<AssetReferenceType>(["script", "storyboard", "prompt", "video"]);
const channels = new Set<ContentChannel>(["web", "douyin", "bilibili"]);
const versionStatuses = new Set<VideoVersionStatus>(["draft", "published", "archived"]);
const viewerEventNames = new Set<ViewerEventName>([
  "play_start",
  "play_progress",
  "cta_impression",
  "cta_click",
  "consultation_click",
  "feedback_submit",
]);
const metricKeys: PlatformMetricKey[] = [
  "views", "likes", "comments", "shares", "reposts", "downloads",
  "averageWatchDurationMs", "coins", "favorites", "danmaku",
];

export const BULK_ASSET_LIMIT = 20;

function repositoryError(kind: ContentOperationsErrorKind, code: string, message: string): never {
  throw new ContentOperationsRepositoryError(kind, code, message);
}

function text(value: unknown, field: string, maxLength: number) {
  if (typeof value !== "string") {
    repositoryError("validation", `invalid_${field}`, `${field} must be a string`);
  }
  const normalized = value.trim();
  if (!normalized || Array.from(normalized).length > maxLength) {
    repositoryError("validation", `invalid_${field}`, `${field} must contain 1-${maxLength} characters`);
  }
  return normalized;
}

function optionalText(value: unknown, field: string, maxLength: number) {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") repositoryError("validation", `invalid_${field}`, `${field} must be a string`);
  const normalized = value.trim();
  if (!normalized) return null;
  if (Array.from(normalized).length > maxLength) {
    repositoryError("validation", `invalid_${field}`, `${field} must contain at most ${maxLength} characters`);
  }
  return normalized;
}

function isoDateTime(value: string, field: string) {
  if (typeof value !== "string") repositoryError("validation", `invalid_${field}`, `${field} must be an ISO date-time`);
  const time = Date.parse(value);
  if (!Number.isFinite(time)) repositoryError("validation", `invalid_${field}`, `${field} must be an ISO date-time`);
  return new Date(time).toISOString();
}

function dateOnly(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) !== value) {
    repositoryError("validation", "invalid_metric_date", "metricDate must use YYYY-MM-DD");
  }
  return value;
}

function externalUrl(value: string, field: string) {
  const normalized = text(value, field, 2_048);
  let url: URL;
  try {
    url = new URL(normalized);
  } catch {
    repositoryError("validation", `invalid_${field}`, `${field} must be a valid URL`);
  }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
    repositoryError("validation", `invalid_${field}`, `${field} must be an http(s) URL without embedded credentials`);
  }
  return url.toString();
}

function nonNegativeInteger(value: number, field: string) {
  if (!Number.isInteger(value) || value < 0) {
    repositoryError("validation", `invalid_${field}`, `${field} must be a non-negative integer`);
  }
  return value;
}

function optionalArray<T>(value: T[] | undefined, field: string): T[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) repositoryError("validation", `invalid_${field}`, `${field} must be an array`);
  return value;
}

function makeId(prefix: string) {
  return `${prefix}_${randomUUID()}`;
}

function overlaps(left: Pick<VideoCta, "startMs" | "endMs">, right: Pick<VideoCta, "startMs" | "endMs">) {
  return Math.max(left.startMs, right.startMs) < Math.min(left.endMs, right.endMs);
}

function requireSeries(data: ContentOperationsData, seriesId: string) {
  const series = data.contentSeries.find((item) => item.id === seriesId);
  if (!series) repositoryError("not_found", "series_not_found", "content series not found");
  return series;
}

function requireVersion(data: ContentOperationsData, videoVersionId: string) {
  const version = data.videoVersions.find((item) => item.id === videoVersionId);
  if (!version) repositoryError("not_found", "version_not_found", "video version not found");
  return version;
}

function requirePublication(data: ContentOperationsData, publicationId: string) {
  const publication = data.channelPublications.find((item) => item.id === publicationId);
  if (!publication) repositoryError("not_found", "publication_not_found", "channel publication not found");
  return publication;
}

function buildAssetReference(videoVersionId: string, input: AssetReferenceDraft, now: string): AssetReference {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    repositoryError("validation", "invalid_asset_reference", "asset reference must be a JSON object");
  }
  if (!assetTypes.has(input.assetType)) repositoryError("validation", "invalid_asset_type", "unsupported asset type");
  return {
    id: makeId("asset"),
    videoVersionId,
    assetType: input.assetType,
    assetVersion: text(input.assetVersion, "assetVersion", 64),
    referenceUrl: externalUrl(input.referenceUrl, "referenceUrl"),
    summary: text(input.summary, "summary", 200),
    createdAt: now,
    updatedAt: now,
  };
}

function validateAssetDraft(
  data: ContentOperationsData,
  videoVersionId: string,
  draft: AssetReferenceDraft,
  seenInBatch: Set<string>,
  now: string,
): AssetReference {
  if (!draft || typeof draft !== "object" || Array.isArray(draft)) {
    repositoryError("validation", "invalid_asset_reference", "asset reference must be a JSON object");
  }
  if (!assetTypes.has(draft.assetType)) {
    repositoryError("validation", "invalid_asset_type", "unsupported asset type");
  }
  const assetVersion = text(draft.assetVersion, "assetVersion", 64);
  const referenceUrl = externalUrl(draft.referenceUrl, "referenceUrl");
  const summary = text(draft.summary, "summary", 200);
  const key = `${draft.assetType}:${assetVersion.toLowerCase()}`;
  if (seenInBatch.has(key)) {
    repositoryError("validation", "duplicate_in_batch", "asset type and version must be unique within the batch");
  }
  if (data.assetReferences.some(
    (item) => item.videoVersionId === videoVersionId
      && item.assetType === draft.assetType
      && item.assetVersion.toLowerCase() === assetVersion.toLowerCase(),
  )) {
    repositoryError("conflict", "duplicate_asset_reference", "asset type and version must be unique per video version");
  }
  seenInBatch.add(key);
  return {
    id: makeId("asset"),
    videoVersionId,
    assetType: draft.assetType,
    assetVersion,
    referenceUrl,
    summary,
    createdAt: now,
    updatedAt: now,
  };
}

function buildVideoCta(videoVersionId: string, durationMs: number, input: VideoCtaDraft, now: string): VideoCta {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    repositoryError("validation", "invalid_cta", "CTA must be a JSON object");
  }
  const startMs = nonNegativeInteger(input.startMs, "startMs");
  const endMs = nonNegativeInteger(input.endMs, "endMs");
  const priority = nonNegativeInteger(input.priority, "priority");
  if (endMs <= startMs || endMs > durationMs) {
    repositoryError("validation", "invalid_cta_window", "CTA window must be within the video duration");
  }
  return {
    id: makeId("cta"),
    videoVersionId,
    startMs,
    endMs,
    label: text(input.label, "label", 100),
    targetAgentId: text(input.targetAgentId, "targetAgentId", 128),
    targetUrl: externalUrl(input.targetUrl, "targetUrl"),
    priority,
    createdAt: now,
    updatedAt: now,
  };
}

function buildPublication(videoVersionId: string, input: ChannelPublicationDraft, now: string): ChannelPublication {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    repositoryError("validation", "invalid_publication", "publication must be a JSON object");
  }
  if (!channels.has(input.channel)) repositoryError("validation", "invalid_channel", "unsupported content channel");
  return {
    id: makeId("publication"),
    videoVersionId,
    channel: input.channel,
    platformVideoId: text(input.platformVideoId, "platformVideoId", 160),
    publicationUrl: externalUrl(input.publicationUrl, "publicationUrl"),
    publishedAt: isoDateTime(input.publishedAt, "publishedAt"),
    createdAt: now,
    updatedAt: now,
  };
}

function appendVersion(data: ContentOperationsData, input: RegisterVideoVersionInput): RegisteredVideoVersion {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    repositoryError("validation", "invalid_version", "video version must be a JSON object");
  }
  requireSeries(data, input.seriesId);
  const versionNumber = text(input.versionNumber, "versionNumber", 32);
  if (data.videoVersions.some((item) => item.seriesId === input.seriesId && item.versionNumber.toLowerCase() === versionNumber.toLowerCase())) {
    repositoryError("conflict", "duplicate_version_number", "version number already exists in this series");
  }
  const durationMs = nonNegativeInteger(input.durationMs, "durationMs");
  if (durationMs === 0) repositoryError("validation", "invalid_duration", "durationMs must be greater than zero");
  const status = input.status || "draft";
  if (!versionStatuses.has(status)) repositoryError("validation", "invalid_version_status", "unsupported version status");
  const publishedAt = input.publishedAt ? isoDateTime(input.publishedAt, "publishedAt") : null;
  const plannedPublishAt = input.plannedPublishAt ? isoDateTime(input.plannedPublishAt, "plannedPublishAt") : null;
  if (status === "published" && !publishedAt) {
    repositoryError("validation", "published_at_required", "published versions require publishedAt");
  }
  if ((input.publications?.length || 0) > 0 && status !== "published") {
    repositoryError("conflict", "version_not_published", "only published versions can have channel publications");
  }

  const now = new Date().toISOString();
  const version: VideoVersion = {
    id: makeId("version"), seriesId: input.seriesId, versionNumber, durationMs,
    publishedAt, plannedPublishAt, status, createdAt: now, updatedAt: now,
    title: optionalText(input.title, "title", 120),
    batch: optionalText(input.batch, "batch", 40),
    registeredBy: optionalText(input.registeredBy, "registeredBy", 60),
    publishedBy: optionalText(input.publishedBy, "publishedBy", 60),
    approvedBy: optionalText(input.approvedBy, "approvedBy", 60),
  };
  const assets = optionalArray(input.assetReferences, "assetReferences").map((item) => buildAssetReference(version.id, item, now));
  const uniqueAssetKeys = new Set(assets.map((item) => `${item.assetType}:${item.assetVersion.toLowerCase()}`));
  if (uniqueAssetKeys.size !== assets.length) {
    repositoryError("conflict", "duplicate_asset_reference", "asset type and version must be unique per video version");
  }

  const versionCtas = optionalArray(input.ctas, "ctas").map((item) => buildVideoCta(version.id, durationMs, item, now));
  for (let left = 0; left < versionCtas.length; left += 1) {
    for (let right = left + 1; right < versionCtas.length; right += 1) {
      if (overlaps(versionCtas[left], versionCtas[right]) && versionCtas[left].priority === versionCtas[right].priority) {
        repositoryError("conflict", "ambiguous_cta_priority", "overlapping CTAs must use different priorities");
      }
    }
  }

  const publications = optionalArray(input.publications, "publications").map((item) => buildPublication(version.id, item, now));
  for (const publication of publications) {
    if (publications.some((item) => item !== publication && item.channel === publication.channel)) {
      repositoryError("conflict", "duplicate_version_channel", "a video version can only bind one publication per channel");
    }
    if (data.channelPublications.some((item) => item.channel === publication.channel && item.platformVideoId === publication.platformVideoId)
      || publications.some((item) => item !== publication && item.channel === publication.channel && item.platformVideoId === publication.platformVideoId)) {
      repositoryError("conflict", "duplicate_platform_video", "channel and platformVideoId must be unique");
    }
  }

  data.videoVersions.unshift(version);
  data.assetReferences.unshift(...assets);
  data.ctas.unshift(...versionCtas);
  data.channelPublications.unshift(...publications);
  return { version, assetReferences: assets, ctas: versionCtas, publications };
}

export async function getContentOperationsCatalog() {
  return readContentOperationsData();
}

export async function listContentSeries() {
  return (await readContentOperationsData()).contentSeries.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function listVideoVersions(seriesId?: string) {
  return (await readContentOperationsData()).videoVersions
    .filter((item) => !seriesId || item.seriesId === seriesId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function listAssetReferences(videoVersionId?: string) {
  return (await readContentOperationsData()).assetReferences.filter((item) => !videoVersionId || item.videoVersionId === videoVersionId);
}

export async function listVideoCtas(videoVersionId?: string) {
  return (await readContentOperationsData()).ctas.filter((item) => !videoVersionId || item.videoVersionId === videoVersionId);
}

export async function listChannelPublications(videoVersionId?: string, channel?: ContentChannel) {
  return (await readContentOperationsData()).channelPublications.filter(
    (item) => (!videoVersionId || item.videoVersionId === videoVersionId) && (!channel || item.channel === channel),
  );
}

export async function listViewerEvents(videoVersionId?: string) {
  return (await readContentOperationsData()).viewerEvents.filter((item) => !videoVersionId || item.videoVersionId === videoVersionId);
}

export async function listViewerFeedback(videoVersionId?: string) {
  return (await readContentOperationsData()).viewerFeedback.filter((item) => !videoVersionId || item.videoVersionId === videoVersionId);
}

export async function listPlatformMetricSnapshots(publicationId?: string) {
  return (await readContentOperationsData()).platformMetricSnapshots
    .filter((item) => !publicationId || item.publicationId === publicationId)
    .sort((a, b) => a.syncedAt.localeCompare(b.syncedAt));
}

export async function getContentOperationsCatalogResponse() {
  const data = await readContentOperationsData();
  return {
    series: data.contentSeries,
    versions: data.videoVersions,
    assetReferences: data.assetReferences,
    ctas: data.ctas,
    publications: data.channelPublications,
    storage: getContentOperationsStorageInfo(),
  };
}

export async function createContentSeries(input: CreateContentSeriesInput): Promise<CreatedContentSeries> {
  return mutateContentOperationsData((data) => {
    const name = text(input.name, "name", 80);
    if (data.contentSeries.some((item) => item.name.toLowerCase() === name.toLowerCase())) {
      repositoryError("conflict", "duplicate_series_name", "content series name already exists");
    }
    const now = new Date().toISOString();
    const series: ContentSeries = {
      id: makeId("series"), name, businessGoal: text(input.businessGoal, "businessGoal", 500), createdAt: now, updatedAt: now,
    };
    data.contentSeries.unshift(series);
    const versions = optionalArray(input.versions, "versions").map((version) => appendVersion(data, { ...version, seriesId: series.id }));
    return { series, versions };
  });
}

export async function registerVideoVersion(input: RegisterVideoVersionInput) {
  return mutateContentOperationsData((data) => appendVersion(data, input));
}

export async function updatePublicationLedger(
  videoVersionId: string,
  patch: PublicationLedgerPatch,
): Promise<VideoVersion> {
  return mutateContentOperationsData((data) => {
    const version = data.videoVersions.find((item) => item.id === videoVersionId);
    if (!version) repositoryError("not_found", "version_not_found", "video version not found");
    if (patch.title !== undefined) version.title = optionalText(patch.title, "title", 120);
    if (patch.batch !== undefined) version.batch = optionalText(patch.batch, "batch", 40);
    if (patch.registeredBy !== undefined) version.registeredBy = optionalText(patch.registeredBy, "registeredBy", 60);
    if (patch.publishedBy !== undefined) version.publishedBy = optionalText(patch.publishedBy, "publishedBy", 60);
    if (patch.approvedBy !== undefined) version.approvedBy = optionalText(patch.approvedBy, "approvedBy", 60);
    if (patch.status !== undefined) {
      if (patch.status !== "published") repositoryError("validation", "invalid_status_transition", "only draft to published is supported here");
      if (version.status !== "draft") repositoryError("conflict", "invalid_status_transition", "only draft versions can be published");
      if (!patch.publishedAt) repositoryError("validation", "published_at_required", "published versions require publishedAt");
      version.status = "published";
      version.publishedAt = isoDateTime(patch.publishedAt, "publishedAt");
    }
    version.updatedAt = new Date().toISOString();
    return version;
  });
}

export async function addAssetReference(videoVersionId: string, input: AssetReferenceDraft) {
  return mutateContentOperationsData((data) => {
    requireVersion(data, videoVersionId);
    const now = new Date().toISOString();
    const asset = buildAssetReference(videoVersionId, input, now);
    if (data.assetReferences.some((item) => item.videoVersionId === videoVersionId && item.assetType === asset.assetType && item.assetVersion.toLowerCase() === asset.assetVersion.toLowerCase())) {
      repositoryError("conflict", "duplicate_asset_reference", "asset type and version must be unique per video version");
    }
    data.assetReferences.unshift(asset);
    return asset;
  });
}

export async function bulkAddAssetReferences(
  videoVersionId: string,
  drafts: AssetReferenceDraft[],
): Promise<AssetReference[]> {
  return mutateContentOperationsData((data) => {
    requireVersion(data, videoVersionId);
    if (!Array.isArray(drafts)) {
      repositoryError("validation", "invalid_assets", "assets must be an array");
    }
    if (drafts.length === 0 || drafts.length > BULK_ASSET_LIMIT) {
      repositoryError("validation", "batch_size_invalid", `assets must contain 1-${BULK_ASSET_LIMIT} entries`);
    }
    const now = new Date().toISOString();
    const seenInBatch = new Set<string>();
    const created = drafts.map((draft) => validateAssetDraft(data, videoVersionId, draft, seenInBatch, now));
    const versionIndex = data.videoVersions.findIndex((item) => item.id === videoVersionId);
    if (versionIndex >= 0) {
      data.videoVersions[versionIndex].updatedAt = now;
    }
    data.assetReferences.push(...created);
    return created;
  });
}

export async function configureVideoCta(videoVersionId: string, input: VideoCtaDraft) {
  return mutateContentOperationsData((data) => {
    const version = requireVersion(data, videoVersionId);
    const now = new Date().toISOString();
    const cta = buildVideoCta(videoVersionId, version.durationMs, input, now);
    const overlapping = data.ctas.filter((item) => item.videoVersionId === videoVersionId && overlaps(item, cta));
    if (overlapping.some((item) => item.priority === cta.priority)) {
      repositoryError("conflict", "ambiguous_cta_priority", "overlapping CTAs must use different priorities");
    }
    data.ctas.unshift(cta);
    return { cta, overlappingCtaIds: overlapping.map((item) => item.id) };
  });
}

export async function createChannelPublication(videoVersionId: string, input: ChannelPublicationDraft) {
  return mutateContentOperationsData((data) => {
    const version = requireVersion(data, videoVersionId);
    if (version.status !== "published") repositoryError("conflict", "version_not_published", "only published versions can be published");
    const publication = buildPublication(videoVersionId, input, new Date().toISOString());
    if (data.channelPublications.some((item) => item.videoVersionId === videoVersionId && item.channel === publication.channel)) {
      repositoryError("conflict", "duplicate_version_channel", "a video version can only bind one publication per channel");
    }
    if (data.channelPublications.some((item) => item.channel === publication.channel && item.platformVideoId === publication.platformVideoId)) {
      repositoryError("conflict", "duplicate_platform_video", "channel and platformVideoId must be unique");
    }
    data.channelPublications.unshift(publication);
    return publication;
  });
}

export function hashViewerSession(sessionId: string) {
  const normalized = text(sessionId, "sessionId", 256);
  if (normalized.length < 8) repositoryError("validation", "weak_session_id", "sessionId must contain at least 8 characters");
  const configuredSalt = process.env.CONTENT_OPERATIONS_SESSION_SALT?.trim();
  if (!configuredSalt && process.env.NODE_ENV === "production") {
    repositoryError("configuration", "session_salt_required", "CONTENT_OPERATIONS_SESSION_SALT must be configured in production");
  }
  const salt = configuredSalt || "friction-x-content-operations-demo-salt-v1";
  return createHmac("sha256", salt).update(normalized).digest("hex");
}

function appendViewerEvent(data: ContentOperationsData, input: RecordViewerEventInput, sessionHash: string) {
  if (!viewerEventNames.has(input.eventName)) {
    repositoryError("validation", "invalid_event_name", "unsupported viewer event name");
  }
  const version = requireVersion(data, input.videoVersionId);
  const positionMs = input.positionMs === undefined ? undefined : nonNegativeInteger(input.positionMs, "positionMs");
  if (positionMs !== undefined && positionMs > version.durationMs) {
    repositoryError("validation", "position_out_of_range", "positionMs exceeds the video duration");
  }
  if (input.publicationId) {
    const publication = requirePublication(data, input.publicationId);
    if (publication.videoVersionId !== version.id || publication.channel !== "web") {
      repositoryError("conflict", "invalid_web_publication", "publication must be a web publication for this version");
    }
  }
  let cta: VideoCta | undefined;
  if (input.ctaId) {
    cta = data.ctas.find((item) => item.id === input.ctaId && item.videoVersionId === version.id);
    if (!cta) repositoryError("not_found", "cta_not_found", "CTA not found for this video version");
  }
  if (["cta_impression", "cta_click", "consultation_click"].includes(input.eventName) && !cta) {
    repositoryError("validation", "cta_required", "CTA events require ctaId");
  }
  if (["play_start", "play_progress", "cta_impression", "cta_click", "consultation_click"].includes(input.eventName)
    && positionMs === undefined) {
    repositoryError("validation", "position_required", `${input.eventName} requires positionMs`);
  }
  if (input.eventName === "play_progress") {
    if (input.progressPercent === undefined || !Number.isInteger(input.progressPercent) || input.progressPercent < 0 || input.progressPercent > 100) {
      repositoryError("validation", "invalid_progress", "play_progress requires progressPercent between 0 and 100");
    }
    const progressTrigger = input.progressTrigger || "threshold";
    if (!(["threshold", "page_close"] as const).includes(progressTrigger)) {
      repositoryError("validation", "invalid_progress_trigger", "progressTrigger must be threshold or page_close");
    }
    if (progressTrigger === "threshold" && ![0, 25, 50, 75, 90, 100].includes(input.progressPercent)) {
      repositoryError("validation", "invalid_progress_threshold", "threshold progress events must use 0, 25, 50, 75, 90, or 100 percent");
    }
    if (progressTrigger === "threshold" && positionMs !== undefined) {
      const expectedPosition = Math.round(version.durationMs * input.progressPercent / 100);
      const tolerance = Math.max(1_000, Math.ceil(version.durationMs * 0.02));
      if (Math.abs(positionMs - expectedPosition) > tolerance) {
        repositoryError("validation", "progress_position_mismatch", "positionMs does not match the reported progress threshold");
      }
    }
  }
  const ctaEvent = ["cta_impression", "cta_click", "consultation_click"].includes(input.eventName);
  if (!ctaEvent && input.ctaId !== undefined) repositoryError("validation", "unexpected_cta_id", `${input.eventName} does not accept ctaId`);
  if (input.eventName !== "play_progress" && (input.progressPercent !== undefined || input.progressTrigger !== undefined)) {
    repositoryError("validation", "unexpected_progress", `${input.eventName} does not accept progress fields`);
  }
  if (!["cta_click", "consultation_click"].includes(input.eventName) && input.targetAgentId !== undefined) {
    repositoryError("validation", "unexpected_target_agent", `${input.eventName} does not accept targetAgentId`);
  }
  if (input.eventName !== "feedback_submit" && input.feedbackId !== undefined) {
    repositoryError("validation", "unexpected_feedback_id", `${input.eventName} does not accept feedbackId`);
  }
  if (cta && positionMs !== undefined && (positionMs < cta.startMs || positionMs > cta.endMs)) {
    repositoryError("validation", "cta_position_out_of_range", "CTA event positionMs must be inside the configured CTA window");
  }
  if (cta && input.targetAgentId && input.targetAgentId !== cta.targetAgentId) {
    repositoryError("conflict", "target_agent_mismatch", "targetAgentId must match the configured CTA target");
  }
  if (input.eventName === "feedback_submit" && !input.feedbackId) {
    repositoryError("validation", "feedback_required", "feedback_submit requires feedbackId");
  }
  if (input.eventName === "feedback_submit") {
    const feedback = data.viewerFeedback.find((item) => item.id === input.feedbackId);
    if (!feedback) repositoryError("not_found", "feedback_not_found", "feedback not found");
    if (feedback.videoVersionId !== version.id || feedback.sessionHash !== sessionHash) {
      repositoryError("conflict", "feedback_session_mismatch", "feedback must belong to this video version and viewer session");
    }
  }

  if (input.id && input.eventId && input.id !== input.eventId) {
    repositoryError("validation", "event_id_mismatch", "id and eventId must match when both are provided");
  }
  const suppliedEventId = input.eventId || input.id;
  if (suppliedEventId) {
    const normalizedEventId = text(suppliedEventId, "eventId", 160);
    const existingById = data.viewerEvents.find((item) => item.id === normalizedEventId);
    if (existingById) {
      if (existingById.videoVersionId !== version.id || existingById.sessionHash !== sessionHash || existingById.eventName !== input.eventName) {
        repositoryError("conflict", "event_id_conflict", "eventId is already used by a different event");
      }
      return existingById;
    }
  }
  const deduplicated = data.viewerEvents.find((item) => {
    if (item.videoVersionId !== version.id || item.sessionHash !== sessionHash || item.eventName !== input.eventName) return false;
    if (input.eventName === "play_start") return true;
    if (input.eventName === "play_progress") return item.progressPercent === input.progressPercent;
    if (input.eventName === "cta_impression") return item.ctaId === input.ctaId;
    if (input.eventName === "feedback_submit") return item.feedbackId === input.feedbackId;
    return false;
  });
  if (deduplicated) return deduplicated;

  const event: ViewerEvent = {
    id: suppliedEventId ? text(suppliedEventId, "eventId", 160) : makeId("event"),
    eventName: input.eventName,
    occurredAt: input.occurredAt ? isoDateTime(input.occurredAt, "occurredAt") : new Date().toISOString(),
    videoVersionId: version.id,
    publicationId: input.publicationId,
    channel: "web",
    sessionHash,
    schemaVersion: 1,
    positionMs,
    progressPercent: input.progressPercent,
    progressTrigger: input.eventName === "play_progress" ? input.progressTrigger || "threshold" : undefined,
    ctaId: cta?.id,
    targetAgentId: cta?.targetAgentId || input.targetAgentId,
    feedbackId: input.feedbackId,
  };
  data.viewerEvents.push(event);
  return event;
}

export async function recordViewerEvent(input: RecordViewerEventInput) {
  if (!input.id && !input.eventId) {
    repositoryError("validation", "event_id_required", "recorded web events require eventId");
  }
  if (input.eventName === "feedback_submit") {
    repositoryError("validation", "feedback_uses_feedback_endpoint", "feedback must be submitted through the feedback endpoint");
  }
  const sessionHash = hashViewerSession(input.sessionId);
  return mutateContentOperationsData((data) => appendViewerEvent(data, { ...input, occurredAt: undefined }, sessionHash));
}

export async function upsertViewerFeedback(input: SubmitViewerFeedbackInput) {
  const sessionHash = hashViewerSession(input.sessionId);
  return mutateContentOperationsData((data) => {
    const version = requireVersion(data, input.videoVersionId);
    for (const [field, value] of [
      ["comprehensionScore", input.comprehensionScore],
      ["interestScore", input.interestScore],
      ["trustScore", input.trustScore],
    ] as const) {
      if (!Number.isInteger(value) || value < 1 || value > 5) {
        repositoryError("validation", `invalid_${field}`, `${field} must be an integer from 1 to 5`);
      }
    }
    const positionMs = input.positionMs === undefined || input.positionMs === null
      ? null
      : nonNegativeInteger(input.positionMs, "positionMs");
    if (positionMs !== null && positionMs > version.durationMs) {
      repositoryError("validation", "position_out_of_range", "positionMs exceeds the video duration");
    }
    const comment = optionalText(input.comment, "comment", 500);
    if (comment && (/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(comment) || /(?:\+?86[- ]?)?1[3-9]\d{9}/.test(comment))) {
      repositoryError("validation", "contact_details_forbidden", "feedback comments cannot contain contact details");
    }
    const occurredAt = new Date().toISOString();
    let feedback = data.viewerFeedback.find((item) => item.videoVersionId === version.id && item.sessionHash === sessionHash);
    if (feedback) {
      feedback.comprehensionScore = input.comprehensionScore;
      feedback.interestScore = input.interestScore;
      feedback.trustScore = input.trustScore;
      feedback.comment = comment;
      feedback.positionMs = positionMs;
      feedback.occurredAt = occurredAt;
      feedback.updatedAt = occurredAt;
    } else {
      feedback = {
        id: makeId("feedback"), videoVersionId: version.id, sessionHash,
        comprehensionScore: input.comprehensionScore, interestScore: input.interestScore,
        trustScore: input.trustScore, comment, positionMs, occurredAt, updatedAt: occurredAt,
      };
      data.viewerFeedback.push(feedback);
    }
    appendViewerEvent(data, {
      eventName: "feedback_submit", occurredAt, videoVersionId: version.id,
      sessionId: input.sessionId, positionMs: positionMs ?? undefined, feedbackId: feedback.id,
    }, sessionHash);
    return feedback;
  });
}

function normalizeMetrics(input: Partial<Record<PlatformMetricKey, PlatformMetricValue>> | undefined) {
  if (input !== undefined && (!input || typeof input !== "object" || Array.isArray(input))) {
    repositoryError("validation", "invalid_metrics", "metrics must be a JSON object");
  }
  return Object.fromEntries(metricKeys.map((key) => {
    const value = input?.[key] ?? "unavailable";
    if (value !== "unavailable" && (!Number.isFinite(value) || value < 0 || !Number.isInteger(value))) {
      repositoryError("validation", `invalid_metric_${key}`, `${key} must be a non-negative integer or unavailable`);
    }
    return [key, value];
  })) as Record<PlatformMetricKey, PlatformMetricValue>;
}

export async function appendPlatformMetricSnapshot(publicationId: string, input: AppendPlatformMetricSnapshotInput) {
  return mutateContentOperationsData((data) => {
    const publication = requirePublication(data, publicationId);
    if (publication.channel === "web") {
      repositoryError("conflict", "web_metrics_use_events", "web performance must be recorded as viewer events");
    }
    if (!(["daily", "cumulative"] as PlatformMetricMode[]).includes(input.metricMode)) {
      repositoryError("validation", "invalid_metric_mode", "metricMode must be daily or cumulative");
    }
    const syncStatus = input.syncStatus || "success";
    if (!(["success", "failed"] as PlatformMetricSyncStatus[]).includes(syncStatus)) {
      repositoryError("validation", "invalid_sync_status", "syncStatus must be success or failed");
    }
    const errorSummary = optionalText(input.errorSummary, "errorSummary", 500);
    if (syncStatus === "failed" && !errorSummary) {
      repositoryError("validation", "error_summary_required", "failed sync attempts require errorSummary");
    }
    const source = input.source || "manual_entry";
    if (!(["official_api", "manual_entry", "demo_seed"] as PlatformMetricSource[]).includes(source)) {
      repositoryError("validation", "invalid_metric_source", "source must be official_api, manual_entry, or demo_seed");
    }
    const metricDate = dateOnly(input.metricDate);
    const syncedAt = input.syncedAt ? isoDateTime(input.syncedAt, "syncedAt") : new Date().toISOString();
    const metrics = syncStatus === "failed" ? normalizeMetrics(undefined) : normalizeMetrics(input.metrics);
    const existing = data.platformMetricSnapshots.find(
      (item) => item.publicationId === publicationId && item.metricDate === metricDate && item.syncedAt === syncedAt,
    );
    if (existing) {
      const samePayload = existing.metricMode === input.metricMode
        && (existing.syncStatus || "success") === syncStatus
        && (existing.errorSummary || null) === errorSummary
        && existing.source === source
        && JSON.stringify(existing.metrics) === JSON.stringify(metrics);
      if (!samePayload) {
        repositoryError("conflict", "snapshot_idempotency_conflict", "a different metric snapshot already exists for this publication, date, and sync time");
      }
      return existing;
    }
    const snapshot: PlatformMetricSnapshot = {
      id: makeId("snapshot"), publicationId, channel: publication.channel,
      platformVideoId: publication.platformVideoId, metricDate, syncedAt,
      precision: "video_or_daily", source, metricMode: input.metricMode,
      metrics,
      syncStatus, errorSummary, createdAt: new Date().toISOString(),
    };
    data.platformMetricSnapshots.push(snapshot);
    return snapshot;
  });
}
