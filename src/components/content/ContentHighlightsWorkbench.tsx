"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, ExternalLink, RefreshCw, Trophy } from "lucide-react";
import { ContentOperationsTabs } from "@/components/content/ContentOperationsTabs";
import { Channel, ContentCatalog, channelLabels, emptyCatalog, getSeriesId, requestJson } from "@/components/content/contentOperationsClient";

type HighlightMetric = {
  key: "completionRate" | "platformEngagementRate" | "ctaClickRate" | "comprehensionScore" | "views";
  label: string;
  value: number | null;
};

type HighlightItem = {
  rank: number | null;
  seriesId: string;
  seriesName: string;
  videoVersionId: string;
  versionNumber: string;
  publicationUrl: string | null;
  primaryMetric: HighlightMetric;
  secondaryMetric: HighlightMetric;
  sampleSize: number;
  status: "valid" | "sample_insufficient" | "data_gap" | "trend_insufficient";
  dataGaps: string[];
};

type HighlightGroup = {
  channel: Channel;
  precision: string;
  items: HighlightItem[];
};

type HighlightsResponse = {
  groups: HighlightGroup[];
  dataAsOf: string | null;
  storage: { mode: string; durable: boolean; warning?: string | null };
};

const statusLabels: Record<HighlightItem["status"], string> = {
  valid: "可用",
  sample_insufficient: "样本不足",
  data_gap: "数据缺口",
  trend_insufficient: "趋势不足"
};

function formatMetric(metric: HighlightMetric) {
  if (metric.value === null || !Number.isFinite(metric.value)) return "不可用";
  if (["completionRate", "platformEngagementRate", "ctaClickRate"].includes(metric.key)) {
    const value = Math.abs(metric.value) <= 1 ? metric.value * 100 : metric.value;
    return `${value.toFixed(1)}%`;
  }
  if (metric.key === "comprehensionScore") return `${metric.value.toFixed(1)} / 5`;
  return new Intl.NumberFormat("zh-CN").format(metric.value);
}

function statusClass(status: HighlightItem["status"]) {
  if (status === "valid") return "badge grade-A";
  if (status === "data_gap") return "badge grade-D";
  return "badge grade-C";
}

function dateInputValue(date: Date) {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

export function ContentHighlightsWorkbench() {
  const [catalog, setCatalog] = useState<ContentCatalog>(emptyCatalog);
  const [payload, setPayload] = useState<HighlightsResponse>({ groups: [], dataAsOf: null, storage: { mode: "memory", durable: false } });
  const [seriesId, setSeriesId] = useState("");
  const [channel, setChannel] = useState<Channel>("web");
  const [rangeDays, setRangeDays] = useState(14);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [error, setError] = useState("");
  const [catalogError, setCatalogError] = useState("");

  useEffect(() => {
    requestJson<ContentCatalog>("/api/content-operations/catalog", { cache: "no-store" })
      .then((result) => setCatalog({ ...emptyCatalog, ...result }))
      .catch((reason: Error) => setCatalogError(reason.message));
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const toDate = new Date();
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - rangeDays + 1);
    const params = new URLSearchParams({ from: dateInputValue(fromDate), to: dateInputValue(toDate) });
    if (seriesId) params.set("seriesId", seriesId);
    setPayload((current) => ({ ...current, groups: [], dataAsOf: null }));
    setLoading(true);
    setError("");
    requestJson<HighlightsResponse>(`/api/content-operations/highlights?${params.toString()}`, { cache: "no-store", signal: controller.signal })
      .then((result) => setPayload({ groups: result.groups || [], dataAsOf: result.dataAsOf || null, storage: result.storage || { mode: "memory", durable: false } }))
      .catch((reason: Error) => {
        if (reason.name !== "AbortError") setError(reason.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [rangeDays, refreshKey, seriesId]);

  const activeGroup = payload.groups.find((group) => group.channel === channel);
  const totalItems = payload.groups.reduce((sum, group) => sum + group.items.length, 0);
  const usableItems = payload.groups.reduce((sum, group) => sum + group.items.filter((item) => item.status === "valid").length, 0);
  const totalGaps = useMemo(() => new Set(payload.groups.flatMap((group) => group.items.flatMap((item) => item.dataGaps))).size, [payload.groups]);

  return (
    <div className="content-operations">
      <ContentOperationsTabs current="highlights" />
      <div className="page-head content-page-head">
        <div><p className="eyebrow">Internal Content Highlights</p><h1>内部内容排行</h1><p className="subtle">依据已登记内容在自有网页、抖音和 B 站的内部表现排序，用于复盘选题；这里不接入或声称展示外部实时热点。</p></div>
        <button className="button secondary" type="button" onClick={() => setRefreshKey((value) => value + 1)} disabled={loading}><RefreshCw size={16} className={loading ? "is-spinning" : ""} />刷新内部排行</button>
      </div>

      <section className="content-disclosure" aria-label="数据声明"><AlertCircle size={18} /><div><strong>演示数据 / 内部表现</strong><span>排行只比较当前系统已有发布记录，并保留样本不足、数据缺口与平台精度限制；不代表全网热度。</span></div></section>
      {error ? <div className="content-notice error" role="alert">{error}</div> : null}
      {catalogError ? <div className="content-notice error" role="alert">内容目录读取失败：{catalogError}</div> : null}

      <section className="panel content-highlights-filters" aria-label="内部排行筛选">
        <label className="content-control wide"><span>内容系列</span><select value={seriesId} onChange={(event) => setSeriesId(event.target.value)}><option value="">全部内容系列</option>{catalog.series.map((item) => <option key={getSeriesId(item)} value={getSeriesId(item)}>{item.name}</option>)}</select></label>
        <div className="content-control"><span>统计时间窗</span><div className="segmented-control" role="group" aria-label="选择统计时间窗">{[7, 14, 30].map((days) => <button key={days} type="button" className={rangeDays === days ? "active" : ""} onClick={() => setRangeDays(days)}>近 {days} 天</button>)}</div></div>
      </section>

      <section className="panel content-kpi-strip" aria-label="内部排行摘要">
        <div className="content-kpi-item"><span>排行条目</span><strong>{totalItems}</strong><small>按渠道分别排名</small></div>
        <div className="content-kpi-item"><span>满足口径</span><strong>{usableItems}</strong><small>可用于内部复盘</small></div>
        <div className="content-kpi-item"><span>数据缺口</span><strong>{totalGaps}</strong><small>不以零值补齐</small></div>
        <div className="content-kpi-item"><span>数据截至</span><strong className="content-date-value">{payload.dataAsOf ? new Date(payload.dataAsOf).toLocaleDateString("zh-CN") : "—"}</strong><small>{payload.storage.mode === "memory" ? "演示存储" : "内部指标快照"}</small></div>
      </section>

      <section className="panel content-highlights-panel">
        <div className="content-panel-head highlights"><div><p className="eyebrow">Channel Ranking</p><h2>渠道内版本排行</h2></div><div className="segmented-control channel" role="group" aria-label="选择排行渠道">{(["web", "douyin", "bilibili"] as Channel[]).map((item) => <button key={item} type="button" className={channel === item ? "active" : ""} onClick={() => setChannel(item)}>{channelLabels[item]}</button>)}</div></div>
        <div className="content-ranking-caption"><span>{activeGroup?.precision || "暂无数据精度"}</span><small>不同渠道只并列展示，不作跨渠道优劣结论</small></div>
        <div className="content-ranking-list" aria-live="polite">
          {activeGroup?.items.map((item) => <article className="content-ranking-row" key={`${channel}-${item.videoVersionId}`}>
            <div className={`content-rank ${item.rank !== null && item.rank <= 3 ? "top" : ""}`}>{item.rank !== null && item.rank <= 3 ? <Trophy size={15} /> : null}<strong>{item.rank === null ? "--" : String(item.rank).padStart(2, "0")}</strong></div>
            <div className="content-ranking-title"><strong>{item.seriesName} · {item.versionNumber}</strong><span>{channelLabels[channel]} · {new Intl.NumberFormat("zh-CN").format(item.sampleSize)} 样本</span></div>
            <div className="content-ranking-metric"><span>{item.primaryMetric.label}</span><strong>{formatMetric(item.primaryMetric)}</strong></div>
            <div className="content-ranking-metric"><span>{item.secondaryMetric.label}</span><strong>{formatMetric(item.secondaryMetric)}</strong></div>
            <div className="content-ranking-status"><span className={statusClass(item.status)}>{statusLabels[item.status]}</span>{item.dataGaps.length ? <small title={item.dataGaps.join("；")}>{item.dataGaps[0]}</small> : <small>指标口径可用</small>}</div>
            {item.publicationUrl ? <a className="icon-button" href={item.publicationUrl} target="_blank" rel="noreferrer" aria-label={`打开 ${item.seriesName} ${item.versionNumber} 发布页`} title="打开发布页"><ExternalLink size={15} /></a> : <span className="content-row-action-placeholder" />}
          </article>)}
          {!loading && !activeGroup?.items.length ? <div className="content-table-empty"><Trophy size={19} /><span>当前渠道与时间窗内暂无可排行内容</span></div> : null}
          {loading ? <div className="content-table-empty">正在计算内部排行…</div> : null}
        </div>
      </section>
    </div>
  );
}
