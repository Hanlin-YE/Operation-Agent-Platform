export type ContentSeries = {
  id?: string;
  seriesId?: string;
  name: string;
  businessGoal: string;
  createdAt?: string;
};

export type VideoVersionStatus = "draft" | "published" | "archived" | string;

export type VideoVersion = {
  id?: string;
  videoVersionId?: string;
  seriesId: string;
  versionNumber: string;
  durationMs: number;
  status: VideoVersionStatus;
  publishedAt?: string | null;
  plannedPublishAt?: string | null;
  title?: string | null;
  batch?: string | null;
  registeredBy?: string | null;
  publishedBy?: string | null;
  approvedBy?: string | null;
  createdAt?: string;
};

export type AssetReference = {
  id?: string;
  assetReferenceId?: string;
  videoVersionId: string;
  assetType: "script" | "storyboard" | "prompt" | "video" | string;
  assetVersion: string;
  referenceUrl: string;
  summary: string;
};

export type VideoCta = {
  id?: string;
  ctaId?: string;
  videoVersionId: string;
  startMs: number;
  endMs: number;
  label: string;
  targetAgentId: string;
  targetUrl: string;
  priority: number;
};

export type Channel = "web" | "douyin" | "bilibili";

export type ChannelPublication = {
  id?: string;
  publicationId?: string;
  videoVersionId: string;
  channel: Channel;
  platformVideoId: string;
  publicationUrl: string;
  publishedAt: string;
  createdAt?: string;
};

export type ContentCatalog = {
  series: ContentSeries[];
  versions: VideoVersion[];
  assetReferences: AssetReference[];
  ctas: VideoCta[];
  publications: ChannelPublication[];
  storage?: { mode?: string; durable?: boolean };
};

export const emptyCatalog: ContentCatalog = {
  series: [],
  versions: [],
  assetReferences: [],
  ctas: [],
  publications: []
};

export const getSeriesId = (item: ContentSeries) => item.seriesId || item.id || "";
export const getVersionId = (item: VideoVersion) => item.videoVersionId || item.id || "";
export const getAssetReferenceId = (item: AssetReference) => item.assetReferenceId || item.id || "";
export const getCtaId = (item: VideoCta) => item.ctaId || item.id || "";
export const getPublicationId = (item: ChannelPublication) => item.publicationId || item.id || "";

export async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const payload = await response.json().catch(() => null) as T | { error?: string; message?: string } | null;
  if (!response.ok) {
    const reason = payload && typeof payload === "object" && ("error" in payload || "message" in payload)
      ? payload.error || payload.message
      : null;
    throw new Error(reason || `请求失败（${response.status}）`);
  }
  if (payload === null) throw new Error("服务返回了空响应");
  return payload as T;
}

export function formatDuration(durationMs: number) {
  const totalSeconds = Math.max(0, Math.round(durationMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function formatDate(value?: string | null) {
  if (!value) return "未发布";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

export const channelLabels: Record<Channel, string> = {
  web: "自有网页",
  douyin: "抖音",
  bilibili: "B 站"
};

export function toLocalDateTimeInput(value = new Date()) {
  const offset = value.getTimezoneOffset() * 60_000;
  return new Date(value.getTime() - offset).toISOString().slice(0, 16);
}

export type AssetReferenceDraft = {
  assetType: "script" | "storyboard" | "prompt" | "video";
  assetVersion: string;
  referenceUrl: string;
  summary: string;
};

export type BulkAssetResponse = {
  accepted: boolean;
  createdIds: string[];
  assets: AssetReference[];
};

export async function bulkAddAssetReferences(
  videoVersionId: string,
  assets: AssetReferenceDraft[],
): Promise<BulkAssetResponse> {
  return requestJson<BulkAssetResponse>("/api/content-operations/assets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ videoVersionId, assets })
  });
}

export type AigcJobSummary = {
  jobId: string;
  projectTitle: string;
  status: string;
  createdAt: string;
  request?: { durationSec?: number };
  result?: {
    outputs: { url: string; outputType: string }[];
  };
};

export async function listSucceededAigcJobs(): Promise<AigcJobSummary[]> {
  const response = await fetch("/api/aigc/jobs", { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`无法获取 AIGC 任务列表（${response.status}）`);
  }
  const payload = await response.json() as AigcJobSummary[];
  return Array.isArray(payload) ? payload.filter((job) => job.status === "succeeded") : [];
}

export function inferAssetType(outputType: string): AssetReferenceDraft["assetType"] {
  const lower = (outputType || "").toLowerCase();
  if (lower.includes("image")) return "storyboard";
  return "video";
}

export type PublicationLedgerPatch = {
  title?: string | null;
  batch?: string | null;
  publishedBy?: string | null;
  approvedBy?: string | null;
};

export async function updatePublicationLedger(
  versionId: string,
  patch: PublicationLedgerPatch
): Promise<VideoVersion> {
  const result = await requestJson<{ version: VideoVersion }>(
    `/api/content-operations/versions/${versionId}/ledger`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch)
    }
  );
  return result.version;
}
