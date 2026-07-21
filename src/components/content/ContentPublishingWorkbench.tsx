"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Archive,
  ExternalLink,
  FileCode2,
  Link2,
  ListFilter,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Video,
  X
} from "lucide-react";
import { ContentOperationsTabs } from "@/components/content/ContentOperationsTabs";
import {
  AssetReference,
  Channel,
  ChannelPublication,
  ContentCatalog,
  ContentSeries,
  VideoCta,
  VideoVersion,
  channelLabels,
  emptyCatalog,
  formatDate,
  formatDuration,
  getSeriesId,
  getPublicationId,
  getVersionId,
  requestJson,
  toLocalDateTimeInput,
  bulkAddAssetReferences as bulkAddAssetReferencesClient,
  listSucceededAigcJobs,
  inferAssetType,
  AigcJobSummary,
  AssetReferenceDraft
} from "@/components/content/contentOperationsClient";

type AssetDraft = {
  assetType: "script" | "storyboard" | "prompt" | "video";
  assetVersion: string;
  referenceUrl: string;
  summary: string;
};

type CtaDraft = {
  startSeconds: string;
  endSeconds: string;
  label: string;
  targetAgentId: string;
  targetUrl: string;
  priority: string;
};

type VersionRow = {
  version: VideoVersion;
  series?: ContentSeries;
  assets: AssetReference[];
  ctas: VideoCta[];
  publications: ChannelPublication[];
};

const initialAsset = (): AssetDraft => ({ assetType: "script", assetVersion: "v1", referenceUrl: "", summary: "" });
const initialCta = (): CtaDraft => ({ startSeconds: "", endSeconds: "", label: "", targetAgentId: "", targetUrl: "", priority: "1" });
const channels: Channel[] = ["web", "douyin", "bilibili"];

const statusLabels: Record<string, string> = {
  draft: "草稿",
  published: "已发布",
  archived: "已归档"
};

function statusClass(status: string) {
  if (status === "published") return "badge grade-A";
  if (status === "archived") return "badge";
  return "badge grade-C";
}

function normalizeCatalog(payload: ContentCatalog): ContentCatalog {
  return {
    ...emptyCatalog,
    ...payload,
    series: Array.isArray(payload.series) ? payload.series : [],
    versions: Array.isArray(payload.versions) ? payload.versions : [],
    assetReferences: Array.isArray(payload.assetReferences) ? payload.assetReferences : [],
    ctas: Array.isArray(payload.ctas) ? payload.ctas : [],
    publications: Array.isArray(payload.publications) ? payload.publications : []
  };
}

function suggestedVersionNumber(catalog: ContentCatalog, seriesId: string) {
  if (!seriesId) return "v1";
  const used = new Set(
    catalog.versions.filter((version) => version.seriesId === seriesId).map((version) => version.versionNumber.toLowerCase())
  );
  let index = 1;
  while (used.has(`v${index}`)) index += 1;
  return `v${index}`;
}

export function ContentPublishingWorkbench() {
  const [catalog, setCatalog] = useState<ContentCatalog>(emptyCatalog);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [channelFilter, setChannelFilter] = useState("all");
  const [versionDialogOpen, setVersionDialogOpen] = useState(false);
  const [versionDialogSource, setVersionDialogSource] = useState<"manual" | "aigc">("manual");
  const [publicationDialogOpen, setPublicationDialogOpen] = useState(false);
  const [publishDialogOpen, setPublishDialogOpen] = useState(false);

  const [seriesMode, setSeriesMode] = useState<"existing" | "new">("new");
  const [selectedSeriesId, setSelectedSeriesId] = useState("");
  const [seriesName, setSeriesName] = useState("");
  const [businessGoal, setBusinessGoal] = useState("");
  const [versionNumber, setVersionNumber] = useState("v1");
  const [durationSeconds, setDurationSeconds] = useState("90");
  const [versionStatus, setVersionStatus] = useState("draft");
  const [versionPublishedAt, setVersionPublishedAt] = useState(toLocalDateTimeInput());
  const [versionPlannedPublishAt, setVersionPlannedPublishAt] = useState(toLocalDateTimeInput());
  const [versionTitle, setVersionTitle] = useState("");
  const [versionBatch, setVersionBatch] = useState("");
  const [versionRegisteredBy, setVersionRegisteredBy] = useState("");
  const [versionPublishedBy, setVersionPublishedBy] = useState("");
  const [versionApprovedBy, setVersionApprovedBy] = useState("");
  const [assets, setAssets] = useState<AssetDraft[]>([initialAsset()]);
  const [ctas, setCtas] = useState<CtaDraft[]>([]);

  const [publicationVersionId, setPublicationVersionId] = useState("");
  const [publicationChannel, setPublicationChannel] = useState<Channel>("web");
  const [platformVideoId, setPlatformVideoId] = useState("");
  const [publicationUrl, setPublicationUrl] = useState("");
  const [publicationPublishedAt, setPublicationPublishedAt] = useState(toLocalDateTimeInput());
  const [publishVersionId, setPublishVersionId] = useState("");
  const [publishActualAt, setPublishActualAt] = useState(toLocalDateTimeInput());
  const [publishActualBy, setPublishActualBy] = useState("");

  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importJobs, setImportJobs] = useState<AigcJobSummary[]>([]);
  const [importJobsError, setImportJobsError] = useState("");
  const [importJobsLoading, setImportJobsLoading] = useState(false);
  const [importVersionId, setImportVersionId] = useState("");
  const [importJobId, setImportJobId] = useState("");
  const [versionAigcJobId, setVersionAigcJobId] = useState("");
  const [importRows, setImportRows] = useState<{ selected: boolean; assetType: AssetReferenceDraft["assetType"]; assetVersion: string; summary: string; url: string; outputType: string }[]>([]);

  async function loadCatalog() {
    const payload = await requestJson<ContentCatalog>("/api/content-operations/catalog", { cache: "no-store" });
    const next = normalizeCatalog(payload);
    setCatalog(next);
    setSelectedSeriesId((current) => current || getSeriesId(next.series[0] || {} as ContentSeries));
    setPublicationVersionId((current) => current || getVersionId(next.versions[0] || {} as VideoVersion));
  }

  useEffect(() => {
    loadCatalog()
      .catch((reason: Error) => setError(reason.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setVersionDialogOpen(false);
        setPublicationDialogOpen(false);
        setPublishDialogOpen(false);
        setImportDialogOpen(false);
      }
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, []);

  const rows = useMemo<VersionRow[]>(() => catalog.versions.map((version) => {
    const versionId = getVersionId(version);
    return {
      version,
      series: catalog.series.find((item) => getSeriesId(item) === version.seriesId),
      assets: catalog.assetReferences.filter((item) => item.videoVersionId === versionId),
      ctas: catalog.ctas.filter((item) => item.videoVersionId === versionId),
      publications: catalog.publications.filter((item) => item.videoVersionId === versionId)
    };
  }), [catalog]);

  const filteredRows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rows.filter((row) => {
      const matchesQuery = !needle || [
        row.series?.name,
        row.series?.businessGoal,
        row.version.versionNumber,
        row.version.title,
        row.version.batch,
        row.version.registeredBy,
        row.version.publishedBy,
        row.version.approvedBy
      ].filter(Boolean).join(" ").toLowerCase().includes(needle);
      const matchesStatus = statusFilter === "all" || row.version.status === statusFilter;
      const matchesChannel = channelFilter === "all" || row.publications.some((item) => item.channel === channelFilter);
      return matchesQuery && matchesStatus && matchesChannel;
    });
  }, [channelFilter, query, rows, statusFilter]);

  const totalVersions = catalog.versions.length;
  const publishedVersions = catalog.versions.filter((item) => item.status === "published").length;
  const draftVersions = catalog.versions.filter((item) => item.status === "draft").length;
  const bindableRows = rows.filter((row) => row.version.status === "published" && new Set(row.publications.map((publication) => publication.channel)).size < channels.length);
  const missingChannelBindings = rows
    .filter((row) => row.version.status === "published")
    .reduce((sum, row) => sum + channels.length - new Set(row.publications.map((publication) => publication.channel)).size, 0);

  function resetVersionForm() {
    const hasSeries = catalog.series.length > 0;
    const firstSeriesId = getSeriesId(catalog.series[0] || {} as ContentSeries);
    setSeriesMode(hasSeries ? "existing" : "new");
    setSelectedSeriesId(firstSeriesId);
    setSeriesName("");
    setBusinessGoal("");
    setVersionNumber(hasSeries ? suggestedVersionNumber(catalog, firstSeriesId) : "v1");
    setDurationSeconds("90");
    setVersionStatus("draft");
    setVersionPublishedAt(toLocalDateTimeInput());
    setVersionPlannedPublishAt(toLocalDateTimeInput());
    setVersionTitle("");
    setVersionBatch("");
    setVersionRegisteredBy("");
    setVersionPublishedBy("");
    setVersionApprovedBy("");
    setVersionAigcJobId("");
    setAssets([initialAsset()]);
    setCtas([]);
  }

  function openVersionDialog() {
    setVersionDialogSource("manual");
    resetVersionForm();
    setError("");
    setNotice("");
    setVersionDialogOpen(true);
  }

  async function openAigcVersionDialog() {
    setVersionDialogSource("aigc");
    resetVersionForm();
    setError("");
    setNotice("");
    setImportJobs([]);
    setImportJobsError("");
    setImportJobsLoading(true);
    setImportJobId("");
    setImportRows([]);
    setVersionDialogOpen(true);
    try {
      const jobs = await listSucceededAigcJobs();
      setImportJobs(jobs);
      if (jobs[0]) applyAigcJob(jobs[0]);
    } catch (reason) {
      setImportJobsError(reason instanceof Error ? reason.message : "无法获取 AIGC 任务列表");
    } finally {
      setImportJobsLoading(false);
    }
  }

  async function openImportDialog() {
    setError("");
    setNotice("");
    setImportDialogOpen(true);
    setImportJobs([]);
    setImportJobsError("");
    setImportJobsLoading(true);
    setImportJobId("");
    setImportRows([]);
    setImportVersionId((current) => current || getVersionId(catalog.versions[0] || {} as VideoVersion));
    try {
      const jobs = await listSucceededAigcJobs();
      setImportJobs(jobs);
    } catch (reason) {
      setImportJobsError(reason instanceof Error ? reason.message : "无法获取 AIGC 任务列表");
    } finally {
      setImportJobsLoading(false);
    }
  }

  function loadJobOutputs(jobId: string) {
    setImportJobId(jobId);
    const job = importJobs.find((item) => item.jobId === jobId);
    if (!job?.result?.outputs?.length) {
      setImportRows([]);
      return;
    }
    const rows = job.result.outputs.map((output) => ({
      selected: true,
      assetType: inferAssetType(output.outputType),
      assetVersion: job.jobId,
      summary: `${job.projectTitle} - ${output.outputType}`.slice(0, 200),
      url: output.url,
      outputType: output.outputType
    }));
    setImportRows(rows);
  }

  function applyAigcJob(job: AigcJobSummary) {
    setImportJobId(job.jobId);
    setVersionAigcJobId(job.jobId);
    const suggested = suggestedVersionNumber(catalog, selectedSeriesId);
    const duration = Number(job.request?.durationSec || 30);
    setVersionNumber(suggested);
    setDurationSeconds(String(Number.isFinite(duration) && duration > 0 ? duration : 30));
    setVersionTitle(`${job.projectTitle} ${suggested}`.trim().slice(0, 120));
    setVersionBatch(`batch-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}`);
    const rows = (job.result?.outputs || []).map((output) => ({
      selected: true,
      assetType: inferAssetType(output.outputType),
      assetVersion: job.jobId,
      summary: `${job.projectTitle} - ${output.outputType}`.slice(0, 200),
      url: output.url,
      outputType: output.outputType
    }));
    setImportRows(rows);
  }

  function updateImportRow(index: number, patch: Partial<{ selected: boolean; assetType: AssetReferenceDraft["assetType"]; assetVersion: string; summary: string }>) {
    setImportRows((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  }

  async function submitImport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (!importVersionId) throw new Error("请选择目标视频版本");
      const selected = importRows.filter((row) => row.selected);
      if (!selected.length) throw new Error("请至少勾选一条 AIGC 输出物");
      const drafts: AssetReferenceDraft[] = selected.map((row) => ({
        assetType: row.assetType,
        assetVersion: row.assetVersion.trim(),
        referenceUrl: row.url,
        summary: row.summary.trim().slice(0, 200)
      }));
      const result = await bulkAddAssetReferencesClient(importVersionId, drafts);
      await loadCatalog();
      setImportDialogOpen(false);
      setNotice(`已登记 ${result.createdIds.length} 条 AIGC 资产引用。`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "导入失败");
    } finally {
      setBusy(false);
    }
  }

  function openPublicationDialog(versionId?: string) {
    const selectedRow = bindableRows.find((row) => getVersionId(row.version) === versionId) || bindableRows[0];
    if (!selectedRow) return;
    const selectedVersionId = getVersionId(selectedRow.version);
    const boundChannels = new Set(selectedRow.publications.map((publication) => publication.channel));
    setPublicationVersionId(selectedVersionId);
    setPublicationChannel(channels.find((channel) => !boundChannels.has(channel)) || "web");
    setPlatformVideoId("");
    setPublicationUrl("");
    setPublicationPublishedAt(toLocalDateTimeInput());
    setError("");
    setNotice("");
    setPublicationDialogOpen(true);
  }

  function openPublishDialog(versionId: string) {
    const row = rows.find((item) => getVersionId(item.version) === versionId);
    if (!row || row.version.status !== "draft") return;
    setPublishVersionId(versionId);
    setPublishActualAt(toLocalDateTimeInput());
    setPublishActualBy(row.version.publishedBy || "");
    setError("");
    setNotice("");
    setPublishDialogOpen(true);
  }

  function selectPublicationVersion(versionId: string) {
    const row = bindableRows.find((item) => getVersionId(item.version) === versionId);
    const boundChannels = new Set(row?.publications.map((publication) => publication.channel) || []);
    setPublicationVersionId(versionId);
    setPublicationChannel(channels.find((channel) => !boundChannels.has(channel)) || "web");
  }

  function updateAsset(index: number, patch: Partial<AssetDraft>) {
    setAssets((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  }

  function updateCta(index: number, patch: Partial<CtaDraft>) {
    setCtas((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  }

  async function registerVersion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const durationMs = Math.round(Number(durationSeconds) * 1000);
      if (!Number.isFinite(durationMs) || durationMs <= 0) throw new Error("视频时长必须大于 0 秒");
      const mappedCtas = ctas.map((item) => ({
        startMs: Math.round(Number(item.startSeconds) * 1000),
        endMs: Math.round(Number(item.endSeconds) * 1000),
        label: item.label.trim(),
        targetAgentId: item.targetAgentId.trim(),
        targetUrl: item.targetUrl.trim(),
        priority: Number(item.priority)
      }));
      const invalidCta = mappedCtas.find((item) => !Number.isFinite(item.startMs) || !Number.isFinite(item.endMs) || item.startMs < 0 || item.endMs <= item.startMs || item.endMs > durationMs);
      if (invalidCta) throw new Error("CTA 时间段必须位于视频时长内，且结束时间晚于开始时间");
      const versionAssets = versionDialogSource === "aigc"
        ? importRows.filter((row) => row.selected).map((row) => ({ assetType: row.assetType, assetVersion: row.assetVersion.trim(), referenceUrl: row.url, summary: row.summary.trim() }))
        : assets.map((item) => ({ ...item, assetVersion: item.assetVersion.trim(), referenceUrl: item.referenceUrl.trim(), summary: item.summary.trim() }));
      if (versionDialogSource === "aigc" && !versionAigcJobId) throw new Error("请选择一个已完成的 AIGC 任务");
      if (versionDialogSource === "aigc" && !versionAssets.length) throw new Error("请至少保留一条 AIGC 输出物");
      const versionInput = {
        versionNumber: versionNumber.trim(),
        durationMs,
        status: versionStatus,
        publishedAt: versionStatus === "published" ? new Date(versionPublishedAt).toISOString() : undefined,
        plannedPublishAt: versionPlannedPublishAt ? new Date(versionPlannedPublishAt).toISOString() : undefined,
        title: versionTitle.trim() || null,
        batch: versionBatch.trim() || null,
        registeredBy: versionRegisteredBy.trim() || null,
        publishedBy: versionPublishedBy.trim() || null,
        approvedBy: versionApprovedBy.trim() || null,
        assetReferences: versionAssets,
        ctas: mappedCtas
      };

      if (seriesMode === "new") {
        await requestJson("/api/content-operations/series", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: seriesName.trim(),
            businessGoal: businessGoal.trim(),
            versions: [versionInput]
          })
        });
      } else {
        if (!selectedSeriesId) throw new Error("请选择一个内容系列");
        await requestJson("/api/content-operations/versions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ seriesId: selectedSeriesId, ...versionInput })
        });
      }
      await loadCatalog();
      setVersionDialogOpen(false);
      setNotice(`已登记 ${versionNumber.trim()} 及其资产、CTA 配置。`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "登记失败");
    } finally {
      setBusy(false);
    }
  }

  async function bindPublication(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await requestJson("/api/content-operations/publications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoVersionId: publicationVersionId,
          channel: publicationChannel,
          platformVideoId: platformVideoId.trim(),
          publicationUrl: publicationUrl.trim(),
          publishedAt: new Date(publicationPublishedAt).toISOString()
        })
      });
      await loadCatalog();
      setPublicationDialogOpen(false);
      setNotice(`已绑定${channelLabels[publicationChannel]}发布记录。`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "绑定失败");
    } finally {
      setBusy(false);
    }
  }

  async function publishVersion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (!publishVersionId) throw new Error("请选择待发布版本");
      await requestJson(`/api/content-operations/versions/${publishVersionId}/ledger`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "published",
          publishedAt: new Date(publishActualAt).toISOString(),
          publishedBy: publishActualBy.trim() || null
        })
      });
      await loadCatalog();
      setPublishDialogOpen(false);
      setNotice("已标记为已发布；现在可继续绑定发布渠道。");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "更新发布状态失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="content-operations">
      <ContentOperationsTabs current="records" />
      <div className="page-head content-page-head">
        <div>
          <p className="eyebrow">Content Registry</p>
          <h1>发布记录</h1>
          <p className="subtle">登记内容系列、视频版本、外部资产引用和 CTA，再把网页、抖音与 B 站发布绑定到同一版本。</p>
        </div>
        <div className="actions">
          <button className="button secondary" type="button" onClick={openAigcVersionDialog} title="选择已完成的 AIGC 任务并登记为发布记录">
            <Sparkles size={16} />从 AIGC 登记发布记录
          </button>
          <button className="button secondary" type="button" onClick={openImportDialog} title="从 AIGC 已完成任务导入资产引用">
            <FileCode2 size={16} />从 AIGC 导入资产
          </button>
          <button className="button secondary" type="button" disabled={!missingChannelBindings} onClick={() => openPublicationDialog()} title={!publishedVersions ? "请先登记已发布的视频版本" : !missingChannelBindings ? "所有已发布版本均已绑定三个渠道" : undefined}>
            <Link2 size={16} />绑定渠道
          </button>
          <button className="button" type="button" onClick={openVersionDialog}><Plus size={16} />登记视频版本</button>
        </div>
      </div>

      {error && !versionDialogOpen && !publicationDialogOpen ? <div className="content-notice error" role="alert">{error}</div> : null}
      {notice ? <div className="content-notice success" role="status">{notice}</div> : null}

      <section className="panel content-kpi-strip" aria-label="发布记录概览">
        <div className="content-kpi-item"><span>内容系列</span><strong>{catalog.series.length}</strong><small>按传播主题归档</small></div>
        <div className="content-kpi-item"><span>全部版本</span><strong>{totalVersions}</strong><small>含草稿、已发布与归档</small></div>
        <div className="content-kpi-item"><span>已发布版本</span><strong>{publishedVersions}</strong><small>可进入同口径比较</small></div>
        <div className="content-kpi-item"><span>待发布草稿</span><strong>{draftVersions}</strong><small>先审批与排期，再绑定渠道</small></div>
        <div className="content-kpi-item"><span>渠道发布</span><strong>{catalog.publications.length}</strong><small>{missingChannelBindings ? `仍有 ${missingChannelBindings} 个待绑定渠道` : "已完成渠道绑定"}</small></div>
      </section>

      <section className="panel content-records-panel">
        <div className="content-panel-head">
          <div><p className="eyebrow">Version Registry</p><h2>视频版本与发布渠道</h2></div>
          <span className="badge">{filteredRows.length} 个版本</span>
        </div>
        <div className="content-toolbar" aria-label="筛选发布记录">
          <label className="content-search-control"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索系列、目标或版本" aria-label="搜索系列、目标或版本" /></label>
          <label className="content-control"><ListFilter size={14} /><span>状态</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">全部状态</option><option value="draft">草稿</option><option value="published">已发布</option><option value="archived">已归档</option></select></label>
          <label className="content-control"><Video size={14} /><span>渠道</span><select value={channelFilter} onChange={(event) => setChannelFilter(event.target.value)}><option value="all">全部渠道</option><option value="web">自有网页</option><option value="douyin">抖音</option><option value="bilibili">B 站</option></select></label>
        </div>

        <div className="content-table-scroll">
          <table className="table content-records-table">
            <thead><tr><th>内容标题</th><th>发布时间</th><th>发布平台</th><th>内容类型</th><th>批次</th><th>登记人</th><th>发布人</th><th>审批人</th><th>状态</th><th><span className="sr-only">操作</span></th></tr></thead>
            <tbody>
              {filteredRows.map((row) => {
                const versionId = getVersionId(row.version);
                const displayTitle = row.version.title || `${row.series?.name || ""} ${row.version.versionNumber}`;
                return <tr key={versionId}>
                  <td><div className="content-title-cell"><strong>{displayTitle}</strong></div></td>
                  <td>{row.version.publishedAt || row.publications[0]?.publishedAt ? `实际 · ${formatDate(row.version.publishedAt || row.publications[0]?.publishedAt)}` : row.version.plannedPublishAt ? `计划 · ${formatDate(row.version.plannedPublishAt)}` : <span className="content-muted-state">待排期</span>}</td>
                  <td>{row.publications.length ? <div className="content-channel-badges">{row.publications.map((item) => <a className="badge" key={getPublicationId(item)} href={item.publicationUrl} target="_blank" rel="noreferrer" title={`打开${channelLabels[item.channel]}发布页`}>{channelLabels[item.channel]}<ExternalLink size={10} /></a>)}</div> : <span className="content-muted-state">未绑定</span>}</td>
                  <td><span className="badge">视频</span></td>
                  <td>{row.version.batch || "—"}</td>
                  <td>{row.version.registeredBy || "—"}</td>
                  <td>{row.version.publishedBy || "—"}</td>
                  <td>{row.version.approvedBy || "—"}</td>
                  <td><span className={statusClass(row.version.status)}>{statusLabels[row.version.status] || row.version.status}</span></td>
                  <td>{row.version.status === "draft" ? <button className="button secondary compact" type="button" onClick={() => openPublishDialog(versionId)}>确认发布</button> : <button className="icon-button" type="button" disabled={new Set(row.publications.map((publication) => publication.channel)).size >= channels.length} onClick={() => openPublicationDialog(versionId)} aria-label={`为 ${displayTitle} 绑定渠道`} title={new Set(row.publications.map((publication) => publication.channel)).size >= channels.length ? "三个渠道均已绑定" : "绑定渠道"}><Link2 size={15} /></button>}</td>
                </tr>;
              })}
              {!loading && !filteredRows.length ? <tr><td colSpan={10}><div className="content-table-empty"><Archive size={20} /><span>{rows.length ? "没有符合当前筛选的版本" : "尚未登记视频版本"}</span></div></td></tr> : null}
              {loading ? <tr><td colSpan={10}><div className="content-table-empty">正在读取内容目录…</div></td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>

      {versionDialogOpen ? (
        <div className="content-dialog-overlay" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setVersionDialogOpen(false)}>
          <section className="content-dialog content-version-dialog" role="dialog" aria-modal="true" aria-labelledby="register-version-title">
            <div className="content-dialog-head"><div><p className="eyebrow">{versionDialogSource === "aigc" ? "Register from AIGC" : "Register Version"}</p><h2 id="register-version-title">{versionDialogSource === "aigc" ? "从 AIGC 登记发布记录" : "登记内容系列与视频版本"}</h2></div><button className="icon-button" type="button" onClick={() => setVersionDialogOpen(false)} aria-label="关闭登记窗口"><X size={17} /></button></div>
            <form onSubmit={registerVersion}>
              <div className="content-dialog-body">
                {error ? <div className="content-notice error" role="alert">{error}</div> : null}
                {versionDialogSource === "aigc" ? <fieldset className="content-form-section"><legend>00 · AIGC 完成任务</legend>
                  {importJobsLoading ? <p className="content-form-help">正在读取已完成的 AIGC 任务…</p> : null}
                  {importJobsError ? <div className="content-notice error" role="alert">{importJobsError}</div> : null}
                  {!importJobsLoading && !importJobs.length ? <p className="content-form-help">暂无已完成任务，请先在 AIGC 工作台完成一次生成。</p> : null}
                  {importJobs.length ? <label className="field full"><span>已完成任务</span><select required value={versionAigcJobId} onChange={(event) => { const job = importJobs.find((item) => item.jobId === event.target.value); if (job) applyAigcJob(job); }}><option value="" disabled>请选择 AIGC 任务</option>{importJobs.map((job) => <option key={job.jobId} value={job.jobId}>{job.projectTitle} · {new Date(job.createdAt).toLocaleString("zh-CN")}</option>)}</select></label> : null}
                  {importRows.length ? <div className="content-form-list"><p className="content-form-help">勾选要随发布记录归档的输出物：</p>{importRows.map((row, index) => <label className="content-form-row asset" key={`${row.url}-${index}`}><input type="checkbox" checked={row.selected} onChange={(event) => setImportRows((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, selected: event.target.checked } : item))} /><span><strong>{row.outputType}</strong><small>{row.summary}</small></span><a href={row.url} target="_blank" rel="noreferrer">打开输出</a></label>)}</div> : null}
                </fieldset> : null}
                <fieldset className="content-form-section"><legend>01 · 内容系列</legend>
                  {catalog.series.length ? <div className="segmented-control" role="group" aria-label="选择内容系列登记方式"><button type="button" className={seriesMode === "existing" ? "active" : ""} onClick={() => { setSeriesMode("existing"); setVersionNumber(suggestedVersionNumber(catalog, selectedSeriesId)); }}>使用已有系列</button><button type="button" className={seriesMode === "new" ? "active" : ""} onClick={() => { setSeriesMode("new"); setVersionNumber("v1"); }}>创建新系列</button></div> : null}
                  {seriesMode === "existing" && catalog.series.length ? <label className="field full"><span>内容系列</span><select required value={selectedSeriesId} onChange={(event) => { setSelectedSeriesId(event.target.value); setVersionNumber(suggestedVersionNumber(catalog, event.target.value)); }}>{catalog.series.map((item) => <option key={getSeriesId(item)} value={getSeriesId(item)}>{item.name} · {item.businessGoal}</option>)}</select></label> : <div className="form-grid"><label className="field"><span>系列名称</span><input required value={seriesName} onChange={(event) => setSeriesName(event.target.value)} placeholder="例如：空心杯电机原理科普" /></label><label className="field"><span>业务目标</span><input required value={businessGoal} onChange={(event) => setBusinessGoal(event.target.value)} placeholder="例如：降低技术理解门槛" /></label></div>}
                </fieldset>

                <fieldset className="content-form-section"><legend>02 · 视频版本</legend><div className="form-grid">
                  <label className="field"><span>版本号</span><input required value={versionNumber} onChange={(event) => setVersionNumber(event.target.value)} placeholder="v1" /></label>
                  <label className="field"><span>视频时长（秒）</span><input required min="1" step="1" type="number" value={durationSeconds} onChange={(event) => setDurationSeconds(event.target.value)} /></label>
                  <label className="field"><span>状态</span><select value={versionStatus} onChange={(event) => setVersionStatus(event.target.value)}><option value="draft">草稿</option><option value="published">已发布</option><option value="archived">已归档</option></select></label>
                  <label className="field"><span>计划发布时间</span><input type="datetime-local" value={versionPlannedPublishAt} onChange={(event) => setVersionPlannedPublishAt(event.target.value)} /></label>
                  {versionStatus === "published" ? <label className="field"><span>发布日期</span><input required type="datetime-local" value={versionPublishedAt} onChange={(event) => setVersionPublishedAt(event.target.value)} /></label> : null}
                </div>
                <div className="form-grid" style={{ marginTop: "0.5rem" }}>
                  <label className="field wide"><span>内容标题</span><input value={versionTitle} onChange={(event) => setVersionTitle(event.target.value)} placeholder="缺省自动生成系列名+版本号" maxLength={120} /></label>
                  <label className="field"><span>批次</span><input value={versionBatch} onChange={(event) => setVersionBatch(event.target.value)} placeholder="如 2026-07-A" maxLength={40} /></label>
                  <label className="field"><span>登记人</span><input value={versionRegisteredBy} onChange={(event) => setVersionRegisteredBy(event.target.value)} maxLength={60} /></label>
                  <label className="field"><span>实际发布人</span><input value={versionPublishedBy} onChange={(event) => setVersionPublishedBy(event.target.value)} maxLength={60} /></label>
                  <label className="field"><span>审批人</span><input value={versionApprovedBy} onChange={(event) => setVersionApprovedBy(event.target.value)} maxLength={60} /></label>
                </div></fieldset>

                {versionDialogSource === "manual" ? <fieldset className="content-form-section"><legend>03 · 外部资产引用</legend><p className="content-form-help">只登记版本号、URL 与摘要，不在分析库复制脚本、提示词或视频文件。</p>
                  <div className="content-form-list">{assets.map((asset, index) => <div className="content-form-row asset" key={`asset-${index}`}>
                    <label className="field"><span>资产类型</span><select value={asset.assetType} onChange={(event) => updateAsset(index, { assetType: event.target.value as AssetDraft["assetType"] })}><option value="script">脚本</option><option value="storyboard">分镜</option><option value="prompt">提示词</option><option value="video">视频</option></select></label>
                    <label className="field"><span>资产版本</span><input required value={asset.assetVersion} onChange={(event) => updateAsset(index, { assetVersion: event.target.value })} /></label>
                    <label className="field wide"><span>外部 URL</span><input required type="url" value={asset.referenceUrl} onChange={(event) => updateAsset(index, { referenceUrl: event.target.value })} placeholder="https://…" /></label>
                    <label className="field wide"><span>摘要</span><input required value={asset.summary} onChange={(event) => updateAsset(index, { summary: event.target.value })} placeholder="用于识别该版本，不粘贴原始内容" /></label>
                    <button className="icon-button danger" type="button" disabled={assets.length === 1} onClick={() => setAssets((items) => items.filter((_, itemIndex) => itemIndex !== index))} aria-label={`删除第 ${index + 1} 个资产引用`} title="删除资产引用"><Trash2 size={15} /></button>
                  </div>)}</div>
                  <button className="button secondary compact" type="button" onClick={() => setAssets((items) => [...items, initialAsset()])}><Plus size={15} />添加资产引用</button>
                </fieldset> : <section className="content-form-section"><h3>03 · AIGC 输出归档</h3><p className="content-form-help">将使用上方勾选的 AIGC 输出物自动创建资产引用，无需重复填写手工 URL。</p></section>}

                <fieldset className="content-form-section"><legend>04 · CTA 配置（可选）</legend><p className="content-form-help">时间以秒登记，提交时转换为毫秒；CTA 结束时间不能超过视频时长。</p>
                  <div className="content-form-list">{ctas.map((cta, index) => <div className="content-form-row cta" key={`cta-${index}`}>
                    <label className="field"><span>开始秒</span><input required min="0" step="0.1" type="number" value={cta.startSeconds} onChange={(event) => updateCta(index, { startSeconds: event.target.value })} /></label>
                    <label className="field"><span>结束秒</span><input required min="0" step="0.1" type="number" value={cta.endSeconds} onChange={(event) => updateCta(index, { endSeconds: event.target.value })} /></label>
                    <label className="field wide"><span>CTA 文案</span><input required value={cta.label} onChange={(event) => updateCta(index, { label: event.target.value })} placeholder="立即咨询技术顾问" /></label>
                    <label className="field"><span>协作者 ID</span><input required value={cta.targetAgentId} onChange={(event) => updateCta(index, { targetAgentId: event.target.value })} /></label>
                    <label className="field wide"><span>目标 URL</span><input required type="url" value={cta.targetUrl} onChange={(event) => updateCta(index, { targetUrl: event.target.value })} placeholder="https://…" /></label>
                    <label className="field"><span>优先级</span><input required min="1" step="1" type="number" value={cta.priority} onChange={(event) => updateCta(index, { priority: event.target.value })} /></label>
                    <button className="icon-button danger" type="button" onClick={() => setCtas((items) => items.filter((_, itemIndex) => itemIndex !== index))} aria-label={`删除第 ${index + 1} 个 CTA`} title="删除 CTA"><Trash2 size={15} /></button>
                  </div>)}</div>
                  {!ctas.length ? <div className="content-inline-empty"><FileCode2 size={18} /><span>当前版本尚未配置 CTA</span></div> : null}
                  <button className="button secondary compact" type="button" onClick={() => setCtas((items) => [...items, initialCta()])}><Plus size={15} />添加 CTA</button>
                </fieldset>
              </div>
              <div className="content-dialog-actions"><button className="button secondary" type="button" onClick={() => setVersionDialogOpen(false)}>取消</button><button className="button" disabled={busy}>{busy ? "登记中…" : "登记系列与版本"}</button></div>
            </form>
          </section>
        </div>
      ) : null}

      {publicationDialogOpen ? (
        <div className="content-dialog-overlay" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setPublicationDialogOpen(false)}>
          <section className="content-dialog content-publication-dialog" role="dialog" aria-modal="true" aria-labelledby="bind-publication-title">
            <div className="content-dialog-head"><div><p className="eyebrow">Bind Publication</p><h2 id="bind-publication-title">绑定渠道发布</h2></div><button className="icon-button" type="button" onClick={() => setPublicationDialogOpen(false)} aria-label="关闭绑定窗口"><X size={17} /></button></div>
            <form onSubmit={bindPublication}>
              <div className="content-dialog-body">
                {error ? <div className="content-notice error" role="alert">{error}</div> : null}
                <label className="field full"><span>视频版本</span><select required value={publicationVersionId} onChange={(event) => selectPublicationVersion(event.target.value)}>{bindableRows.map((row) => <option key={getVersionId(row.version)} value={getVersionId(row.version)}>{row.series?.name || "未知系列"} · {row.version.versionNumber}</option>)}</select></label>
                <div className="field full"><span>发布渠道</span><div className="segmented-control channel" role="group" aria-label="选择发布渠道">{channels.map((channel) => { const alreadyBound = catalog.publications.some((publication) => publication.videoVersionId === publicationVersionId && publication.channel === channel); return <button type="button" key={channel} className={publicationChannel === channel ? "active" : ""} disabled={alreadyBound} title={alreadyBound ? "该渠道已绑定" : undefined} onClick={() => setPublicationChannel(channel)}>{channelLabels[channel]}</button>; })}</div></div>
                <div className="form-grid">
                  <label className="field"><span>平台视频标识</span><input required value={platformVideoId} onChange={(event) => setPlatformVideoId(event.target.value)} placeholder={publicationChannel === "web" ? "网页视频 slug / ID" : "平台视频 ID"} /></label>
                  <label className="field"><span>发布时间</span><input required type="datetime-local" value={publicationPublishedAt} onChange={(event) => setPublicationPublishedAt(event.target.value)} /></label>
                  <label className="field full"><span>发布 URL</span><input required type="url" value={publicationUrl} onChange={(event) => setPublicationUrl(event.target.value)} placeholder="https://…" /></label>
                </div>
              </div>
              <div className="content-dialog-actions"><button className="button secondary" type="button" onClick={() => setPublicationDialogOpen(false)}>取消</button><button className="button" disabled={busy}>{busy ? "绑定中…" : "确认绑定"}</button></div>
            </form>
          </section>
        </div>
      ) : null}

      {publishDialogOpen ? (
        <div className="content-dialog-overlay" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setPublishDialogOpen(false)}>
          <section className="content-dialog content-publication-dialog" role="dialog" aria-modal="true" aria-labelledby="publish-version-title">
            <div className="content-dialog-head"><div><p className="eyebrow">Publish Version</p><h2 id="publish-version-title">确认内容发布</h2></div><button className="icon-button" type="button" onClick={() => setPublishDialogOpen(false)} aria-label="关闭发布窗口"><X size={17} /></button></div>
            <form onSubmit={publishVersion}>
              <div className="content-dialog-body">
                {error ? <div className="content-notice error" role="alert">{error}</div> : null}
                <p className="content-form-help">确认后该版本将从草稿变为已发布，随后可登记网页、抖音或 B 站的实际发布链接。</p>
                <div className="form-grid">
                  <label className="field"><span>实际发布时间</span><input required type="datetime-local" value={publishActualAt} onChange={(event) => setPublishActualAt(event.target.value)} /></label>
                  <label className="field"><span>实际发布人</span><input value={publishActualBy} onChange={(event) => setPublishActualBy(event.target.value)} maxLength={60} /></label>
                </div>
              </div>
              <div className="content-dialog-actions"><button className="button secondary" type="button" onClick={() => setPublishDialogOpen(false)}>取消</button><button className="button" disabled={busy}>{busy ? "发布中…" : "确认发布"}</button></div>
            </form>
          </section>
        </div>
      ) : null}

      {importDialogOpen ? (
        <div className="content-dialog-overlay" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setImportDialogOpen(false)}>
          <section className="content-dialog content-import-dialog" role="dialog" aria-modal="true" aria-labelledby="import-aigc-title">
            <div className="content-dialog-head"><div><p className="eyebrow">Import from AIGC</p><h2 id="import-aigc-title">从 AIGC 导入资产引用</h2></div><button className="icon-button" type="button" onClick={() => setImportDialogOpen(false)} aria-label="关闭导入窗口"><X size={17} /></button></div>
            <form onSubmit={submitImport}>
              <div className="content-dialog-body">
                {error ? <div className="content-notice error" role="alert">{error}</div> : null}
                <label className="field full"><span>目标视频版本</span><select required value={importVersionId} onChange={(event) => setImportVersionId(event.target.value)}>
                  {catalog.versions.length ? catalog.versions.map((version) => {
                    const series = catalog.series.find((item) => getSeriesId(item) === version.seriesId);
                    return <option key={getVersionId(version)} value={getVersionId(version)}>{series?.name || "未知系列"} · {version.versionNumber}</option>;
                  }) : <option value="" disabled>暂无视频版本，请先登记</option>}
                </select></label>
                <label className="field full"><span>AIGC 任务（仅显示已成功）</span>
                  {importJobsLoading ? <div className="content-inline-empty">正在读取 AIGC 任务…</div>
                      : importJobsError ? <div className="content-notice error" role="alert">{importJobsError}</div>
                      : importJobs.length === 0 ? <div className="content-inline-empty"><span>暂无已完成的 AIGC 任务</span></div>
                      : <select value={importJobId} onChange={(event) => loadJobOutputs(event.target.value)}>
                          <option value="">请选择一个 AIGC 任务</option>
                          {importJobs.map((job) => <option key={job.jobId} value={job.jobId}>{job.projectTitle} · {new Date(job.createdAt).toLocaleString("zh-CN")}</option>)}
                        </select>}
                </label>
                {importJobId && importRows.length > 0 ? (
                  <fieldset className="content-form-section"><legend>输出物与字段</legend>
                    <div className="content-form-list">
                      {importRows.map((row, index) => (
                        <div className="content-form-row asset" key={`import-${index}`}>
                          <label className="field compact"><input type="checkbox" checked={row.selected} onChange={(event) => updateImportRow(index, { selected: event.target.checked })} aria-label={`勾选第 ${index + 1} 条输出`} /></label>
                          <label className="field"><span>资产类型</span><select value={row.assetType} onChange={(event) => updateImportRow(index, { assetType: event.target.value as AssetReferenceDraft["assetType"] })}><option value="script">脚本</option><option value="storyboard">分镜</option><option value="prompt">提示词</option><option value="video">视频</option></select></label>
                          <label className="field"><span>资产版本</span><input value={row.assetVersion} onChange={(event) => updateImportRow(index, { assetVersion: event.target.value })} /></label>
                          <label className="field wide"><span>摘要</span><input value={row.summary} maxLength={200} onChange={(event) => updateImportRow(index, { summary: event.target.value })} /></label>
                          <a className="content-import-url-hint" href={row.url} target="_blank" rel="noreferrer" title={`输出类型：${row.outputType}`}>{row.outputType} · 打开</a>
                        </div>
                      ))}
                    </div>
                  </fieldset>
                ) : null}
                {!importJobId && !importJobsLoading && !importJobsError && importJobs.length > 0 ? <p className="content-form-help">选择一个 AIGC 任务以加载其输出物。</p> : null}
              </div>
              <div className="content-dialog-actions"><button className="button secondary" type="button" onClick={() => setImportDialogOpen(false)}>取消</button><button className="button" disabled={busy || !importRows.some((row) => row.selected)}>{busy ? "登记中…" : `登记 ${importRows.filter((row) => row.selected).length} 条资产`}</button></div>
            </form>
          </section>
        </div>
      ) : null}
    </div>
  );
}
