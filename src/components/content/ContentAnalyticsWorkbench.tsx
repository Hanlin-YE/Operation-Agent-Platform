"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, BarChart3, CheckCircle2, Clock3, MousePointerClick, RefreshCw } from "lucide-react";
import { ContentOperationsTabs } from "@/components/content/ContentOperationsTabs";
import {
  Channel,
  ContentCatalog,
  VideoVersion,
  channelLabels,
  emptyCatalog,
  formatDuration,
  getSeriesId,
  getVersionId,
  requestJson
} from "@/components/content/contentOperationsClient";

type Metric = {
  value: number | null;
  numerator?: number;
  denominator?: number;
  sampleSize?: number;
  status: "available" | "unavailable";
  dataGaps: string[];
};

type Performance = {
  version: { videoVersionId: string; versionNumber: string; status: string; publishedAt?: string | null };
  channel: Channel;
  sampleSize: number;
  precision: string;
  eligibility: "valid" | "sample_insufficient" | "data_gap" | "trend_insufficient";
  metrics: {
    uniqueViewSessions: number;
    completionRate: Metric;
    ctaClickRate: Metric;
    comprehensionScore: Metric;
    interestScore: Metric;
    trustScore: Metric;
    platformEngagementRate: Metric;
  };
  ctaPerformance: Array<{
    ctaId: string;
    label: string;
    startMs: number;
    endMs: number;
    reachedSessions: number;
    exposureRate: number | null;
    clickRate: number | null;
    consultationRate: number | null;
  }>;
  dataGaps: string[];
};

type Comparison = {
  metric: string;
  status: "obvious_difference" | "no_obvious_difference" | "not_comparable" | "observation_only";
  leftVersionId: string;
  rightVersionId: string;
  delta: number | null;
  unit: string;
  winnerVersionId?: string;
  reason?: string;
};

type DashboardResponse = {
  query: { seriesId: string; channel: Channel; versionIds: string[]; from: string; to: string };
  series: { seriesId: string; name: string; businessGoal: string } | null;
  performances: Performance[];
  comparisons: Comparison[];
  recommendations: Array<{ conclusion: string; evidence: string[]; dataPrecision: string; confidence: string; recommendedAction: string }>;
  channelStatus: Array<{ channel: Channel; precision: string; status: string; dataGaps: string[] }>;
  dataGaps: string[];
  storage: { mode: string; durable: boolean; warning?: string | null };
};

const emptyDashboard: DashboardResponse = {
  query: { seriesId: "", channel: "web", versionIds: [], from: "", to: "" },
  series: null,
  performances: [],
  comparisons: [],
  recommendations: [],
  channelStatus: [],
  dataGaps: [],
  storage: { mode: "memory", durable: false }
};

type MetricRowKey = Exclude<keyof Performance["metrics"], "uniqueViewSessions"> | "sampleSize";

const metricRows: Array<{ key: MetricRowKey; label: string; kind: "count" | "rate" | "score" }> = [
  { key: "sampleSize", label: "独立观看会话 / 播放样本", kind: "count" },
  { key: "completionRate", label: "完播率", kind: "rate" },
  { key: "ctaClickRate", label: "CTA 点击率", kind: "rate" },
  { key: "comprehensionScore", label: "理解度", kind: "score" },
  { key: "interestScore", label: "兴趣度", kind: "score" },
  { key: "trustScore", label: "信任度", kind: "score" },
  { key: "platformEngagementRate", label: "平台互动率", kind: "rate" }
];

const eligibilityLabels: Record<Performance["eligibility"], string> = {
  valid: "可比较",
  sample_insufficient: "样本不足",
  data_gap: "数据缺口",
  trend_insufficient: "趋势不足"
};

const comparisonLabels: Record<Comparison["status"], string> = {
  obvious_difference: "明显差异",
  no_obvious_difference: "暂无明显差异",
  not_comparable: "不可比较",
  observation_only: "仅供观察"
};

const comparisonReasonLabels: Record<string, string> = {
  data_gap: "指标存在数据缺口",
  sample_insufficient: "样本不足，仅供观察",
  platform_trend_insufficient: "平台连续数据不足 7 天",
  cross_channel: "跨渠道不作优劣比较",
  different_series: "内容系列不同",
  different_window: "统计时间窗不同",
  unpublished_version: "包含未发布版本",
  same_version: "相同版本无需比较"
};

const channelStatusLabels: Record<string, string> = {
  valid: "数据可用",
  data_gap: "数据缺口",
  sample_insufficient: "样本不足",
  trend_insufficient: "趋势不足",
  no_data: "暂无数据"
};

const confidenceLabels: Record<string, string> = {
  low: "低",
  medium: "中",
  high: "高"
};

function dateInputValue(date: Date) {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

function rateValue(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  return Math.abs(value) <= 1 ? value * 100 : value;
}

function formatValue(value: number | null | undefined, kind: "count" | "rate" | "score") {
  if (value === null || value === undefined || !Number.isFinite(value)) return "不可用";
  if (kind === "rate") return `${rateValue(value)?.toFixed(1)}%`;
  if (kind === "score") return `${value.toFixed(1)} / 5`;
  return new Intl.NumberFormat("zh-CN").format(value);
}

function metricValue(performance: Performance, key: typeof metricRows[number]["key"]) {
  if (key === "sampleSize") return performance.sampleSize;
  return performance.metrics[key].status === "available" ? performance.metrics[key].value : null;
}

function comparisonClass(status: Comparison["status"]) {
  if (status === "obvious_difference") return "badge grade-A";
  if (status === "not_comparable") return "badge grade-D";
  if (status === "observation_only") return "badge grade-C";
  return "badge";
}

function comparableVersionIds(catalog: ContentCatalog, seriesId: string, channel: Channel) {
  const boundVersionIds = new Set(
    catalog.publications.filter((publication) => publication.channel === channel).map((publication) => publication.videoVersionId)
  );
  return catalog.versions
    .filter((version) => version.seriesId === seriesId && version.status === "published" && boundVersionIds.has(getVersionId(version)))
    .map(getVersionId)
    .filter(Boolean)
    .slice(0, 2);
}

export function ContentAnalyticsWorkbench() {
  const today = useMemo(() => new Date(), []);
  const initialFrom = useMemo(() => {
    const value = new Date(today);
    value.setDate(value.getDate() - 13);
    return dateInputValue(value);
  }, [today]);
  const [catalog, setCatalog] = useState<ContentCatalog>(emptyCatalog);
  const [dashboard, setDashboard] = useState<DashboardResponse>(emptyDashboard);
  const [seriesId, setSeriesId] = useState("");
  const [channel, setChannel] = useState<Channel>("web");
  const [versionIds, setVersionIds] = useState<string[]>([]);
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(dateInputValue(today));
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [loadingDashboard, setLoadingDashboard] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    requestJson<ContentCatalog>("/api/content-operations/catalog", { cache: "no-store" })
      .then((payload) => {
        const next = { ...emptyCatalog, ...payload };
        setCatalog(next);
        const firstSeriesId = getSeriesId(next.series[0] || {});
        setSeriesId(firstSeriesId);
        setVersionIds(comparableVersionIds(next, firstSeriesId, "web"));
      })
      .catch((reason: Error) => setError(reason.message))
      .finally(() => setLoadingCatalog(false));
  }, []);

  useEffect(() => {
    if (!seriesId) {
      setDashboard(emptyDashboard);
      return;
    }
    const controller = new AbortController();
    const params = new URLSearchParams({ seriesId, channel, from, to });
    if (versionIds.length) params.set("versionIds", versionIds.join(","));
    setDashboard(emptyDashboard);
    setLoadingDashboard(true);
    setError("");
    requestJson<DashboardResponse>(`/api/content-operations/dashboard?${params.toString()}`, { cache: "no-store", signal: controller.signal })
      .then((payload) => setDashboard({ ...emptyDashboard, ...payload, performances: payload.performances || [], comparisons: payload.comparisons || [], recommendations: payload.recommendations || [], channelStatus: payload.channelStatus || [], dataGaps: payload.dataGaps || [] }))
      .catch((reason: Error) => {
        if (reason.name !== "AbortError") setError(reason.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingDashboard(false);
      });
    return () => controller.abort();
  }, [channel, from, refreshKey, seriesId, to, versionIds]);

  const seriesVersions = catalog.versions.filter((item) => item.seriesId === seriesId);
  const totalSample = dashboard.performances.reduce((sum, item) => sum + item.sampleSize, 0);
  const bestCompletion = Math.max(...dashboard.performances.map((item) => rateValue(item.metrics.completionRate.value) ?? -Infinity));
  const bestCta = Math.max(...dashboard.performances.flatMap((item) => item.ctaPerformance.map((cta) => rateValue(cta.clickRate) ?? -Infinity)));
  const allDataGaps = Array.from(new Set([...dashboard.dataGaps, ...dashboard.performances.flatMap((item) => item.dataGaps)]));

  function selectSeries(nextSeriesId: string) {
    setSeriesId(nextSeriesId);
    setVersionIds(comparableVersionIds(catalog, nextSeriesId, channel));
  }

  function selectChannel(nextChannel: Channel) {
    setChannel(nextChannel);
    setVersionIds(comparableVersionIds(catalog, seriesId, nextChannel));
  }

  function toggleVersion(versionId: string) {
    setVersionIds((items) => items.includes(versionId) ? (items.length > 1 ? items.filter((item) => item !== versionId) : items) : [...items, versionId].slice(-2));
  }

  return (
    <div className="content-operations">
      <ContentOperationsTabs current="analytics" />
      <div className="page-head content-page-head">
        <div><p className="eyebrow">Audience Performance</p><h1>用户数据分析</h1><p className="subtle">在同一内容系列、单一渠道和相同时间窗内比较视频版本；样本与精度不满足规则时只展示观察，不生成胜负结论。</p></div>
        <button className="button secondary" type="button" onClick={() => setRefreshKey((value) => value + 1)} disabled={loadingDashboard || !seriesId}><RefreshCw size={16} className={loadingDashboard ? "is-spinning" : ""} />同步数据</button>
      </div>

      {error ? <div className="content-notice error" role="alert">{error}</div> : null}

      <section className="panel content-analysis-filters" aria-label="分析范围">
        <div className="content-filter-row">
          <label className="content-control wide"><span>内容系列</span><select value={seriesId} onChange={(event) => selectSeries(event.target.value)} disabled={loadingCatalog}><option value="">{loadingCatalog ? "正在读取…" : "请选择内容系列"}</option>{catalog.series.map((item) => <option key={getSeriesId(item)} value={getSeriesId(item)}>{item.name}</option>)}</select></label>
          <div className="content-control channel-filter"><span>单一渠道</span><div className="segmented-control channel" role="group" aria-label="选择单一分析渠道">{(["web", "douyin", "bilibili"] as Channel[]).map((item) => <button key={item} type="button" className={channel === item ? "active" : ""} onClick={() => selectChannel(item)}>{channelLabels[item]}</button>)}</div></div>
          <label className="content-control"><span>开始日期</span><input required type="date" value={from} max={to} onChange={(event) => event.target.value && setFrom(event.target.value)} /></label>
          <label className="content-control"><span>结束日期</span><input required type="date" value={to} min={from} onChange={(event) => event.target.value && setTo(event.target.value)} /></label>
        </div>
          <div className="content-version-picker"><span>参与比较的版本（最多 2 个）</span><div>{seriesVersions.map((version) => { const id = getVersionId(version); const published = version.status === "published"; const bound = catalog.publications.some((publication) => publication.videoVersionId === id && publication.channel === channel); const selected = versionIds.includes(id); const eligible = published && bound; const disabled = !eligible || (!selected && versionIds.length >= 2); const title = !published ? "仅已发布版本参与比较" : !bound ? `该版本尚未绑定${channelLabels[channel]}` : !selected && versionIds.length >= 2 ? "最多选择两个版本" : undefined; return <button type="button" key={id} className={selected ? "active" : ""} disabled={disabled} title={title} onClick={() => toggleVersion(id)} aria-pressed={selected}>{version.versionNumber}<small>{!published ? "未发布" : bound ? "已绑定" : "未绑定渠道"}</small></button>; })}{!seriesVersions.length ? <small>当前系列暂无视频版本</small> : null}</div></div>
      </section>

      <section className="panel content-kpi-strip content-analysis-kpis" aria-label="当前分析摘要">
        <div className="content-kpi-item"><span>样本量</span><strong>{new Intl.NumberFormat("zh-CN").format(totalSample)}</strong><small>{channel === "web" ? "独立观看会话" : "平台播放样本"}</small></div>
        <div className="content-kpi-item"><span>最佳完播率</span><strong>{Number.isFinite(bestCompletion) ? `${bestCompletion.toFixed(1)}%` : "—"}</strong><small>仅在同渠道内观察</small></div>
        <div className="content-kpi-item"><span>最佳 CTA 点击率</span><strong>{Number.isFinite(bestCta) ? `${bestCta.toFixed(1)}%` : "—"}</strong><small>{channel === "web" ? "网页端精确事件" : "平台端通常不可用"}</small></div>
        <div className="content-kpi-item"><span>数据缺口</span><strong>{allDataGaps.length}</strong><small>{dashboard.storage.mode === "memory" ? "当前为演示存储" : "按服务状态汇总"}</small></div>
      </section>

      <section className="panel content-comparison-panel">
        <div className="content-panel-head"><div><p className="eyebrow">Version Comparison</p><h2>版本指标比较</h2></div><span className="badge">{channelLabels[channel]} · {from} 至 {to}</span></div>
        <div className="content-table-scroll">
          <table className="table content-metric-table">
            <thead><tr><th>指标</th>{dashboard.performances.map((item) => <th key={item.version.videoVersionId}>{item.version.versionNumber}<small>{item.sampleSize} 样本 · {item.precision}</small></th>)}<th>比较结论</th></tr></thead>
            <tbody>{metricRows.map((row) => {
              const comparison = dashboard.comparisons.find((item) => item.metric === row.key);
              return <tr key={row.key}><th>{row.label}</th>{dashboard.performances.map((performance) => { const value = metricValue(performance, row.key); const available = value !== null; return <td key={`${row.key}-${performance.version.videoVersionId}`}><strong>{formatValue(value, row.kind)}</strong><small className={available && performance.eligibility === "valid" ? "content-precision valid" : "content-precision warning"}>{available ? eligibilityLabels[performance.eligibility] : "指标不可用"}</small></td>; })}<td>{comparison ? <div className="content-comparison-result"><span className={comparisonClass(comparison.status)}>{comparisonLabels[comparison.status]}</span>{comparison.reason ? <small>{comparisonReasonLabels[comparison.reason] || comparison.reason}</small> : null}</div> : <span className="content-muted-state">暂无比较</span>}</td></tr>;
            })}{!loadingDashboard && !dashboard.performances.length ? <tr><td colSpan={3 + versionIds.length}><div className="content-table-empty">当前范围内没有可展示的指标</div></td></tr> : null}</tbody>
          </table>
        </div>
      </section>

      <div className="content-analysis-grid">
        <section className="panel content-cta-panel">
          <div className="content-panel-head"><div><p className="eyebrow">CTA Performance</p><h2>CTA 表现与时间位置</h2></div><MousePointerClick size={18} /></div>
          <div className="content-cta-timeline">{dashboard.performances.flatMap((performance) => performance.ctaPerformance.map((cta) => {
            const version = catalog.versions.find((item) => getVersionId(item) === performance.version.videoVersionId);
            const duration = version?.durationMs || Math.max(cta.endMs, 1);
            const left = Math.min(100, Math.max(0, cta.startMs / duration * 100));
            const width = Math.max(1.5, Math.min(100 - left, (cta.endMs - cta.startMs) / duration * 100));
            return <div className="content-cta-row" key={`${performance.version.videoVersionId}-${cta.ctaId}`}><div><strong>{performance.version.versionNumber} · {cta.label}</strong><span>{formatDuration(cta.startMs)}–{formatDuration(cta.endMs)} · 到达 {cta.reachedSessions} · 点击 {formatValue(cta.clickRate, "rate")}</span></div><div className="content-playback-track" aria-label={`${cta.label} 位于视频 ${left.toFixed(0)}% 处`}><span style={{ left: `${left}%`, width: `${width}%` }} /></div></div>;
          }))}{!dashboard.performances.some((item) => item.ctaPerformance.length) ? <div className="content-inline-empty"><Clock3 size={18} /><span>{channel === "web" ? "所选版本暂无 CTA 事件" : "平台渠道不提供片段级 CTA 数据"}</span></div> : null}</div>
        </section>

        <section className="panel content-channel-panel">
          <div className="content-panel-head"><div><p className="eyebrow">Channel Precision</p><h2>渠道数据精度</h2></div><BarChart3 size={18} /></div>
          <div className="content-channel-strip">{dashboard.channelStatus.map((item) => <div key={item.channel}><span>{channelLabels[item.channel]}</span><strong>{item.precision}</strong><small>{channelStatusLabels[item.status] || item.status}{item.dataGaps.length ? ` · ${item.dataGaps.join("；")}` : ""}</small></div>)}{!dashboard.channelStatus.length ? <div className="content-inline-empty"><span>暂无渠道同步状态</span></div> : null}</div>
        </section>
      </div>

      <section className="panel content-recommendations-panel">
        <div className="content-panel-head"><div><p className="eyebrow">Optimization Brief</p><h2>可追溯优化建议</h2></div><span className="badge">{dashboard.recommendations.length} 条</span></div>
        <div className="content-recommendation-list">{dashboard.recommendations.map((item, index) => <article key={`${item.conclusion}-${index}`}><div className="content-recommendation-index">{String(index + 1).padStart(2, "0")}</div><div><h3>{item.conclusion}</h3><p><strong>建议动作：</strong>{item.recommendedAction}</p><div className="content-evidence-row">{item.evidence.map((evidence) => <span key={evidence}>{evidence}</span>)}</div><small>{item.dataPrecision} · 置信度 {confidenceLabels[item.confidence] || item.confidence}</small></div></article>)}{!dashboard.recommendations.length ? <div className="content-inline-empty"><CheckCircle2 size={18} /><span>当前数据尚未形成满足规则的优化建议</span></div> : null}</div>
      </section>

      {allDataGaps.length ? <section className="content-data-gap" aria-label="数据缺口"><AlertTriangle size={18} /><div><strong>当前分析限制</strong><ul>{allDataGaps.map((item) => <li key={item}>{item}</li>)}</ul></div></section> : null}
    </div>
  );
}
