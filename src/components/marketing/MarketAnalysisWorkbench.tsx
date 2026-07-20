"use client";

import { useState } from "react";
import { BarChart3, CircleAlert, Compass, Crosshair, Radar, Sparkles } from "lucide-react";
import { MarketAnalysisReport, MarketFocus } from "@/server/data/types";

export type MarketWorkbenchView = "overview" | "opportunities" | "competitors" | "strategy";

const focusOptions: Array<{ value: MarketFocus; label: string }> = [
  { value: "all", label: "全市场机会" },
  { value: "robotics", label: "人形机器人与灵巧手" },
  { value: "medical", label: "医疗精密设备" },
  { value: "industrial", label: "工业自动化" },
  { value: "automotive", label: "汽车电子" },
  { value: "aerospace", label: "无人机与航空航天" }
];

function labelClass(label: string) {
  if (label === "企业知识") return "badge grade-A";
  if (label === "待市场验证") return "badge grade-C";
  return "badge";
}

export function MarketAnalysisWorkbench({ initialReports, view = "overview" }: { initialReports: MarketAnalysisReport[]; view?: MarketWorkbenchView }) {
  const [reports, setReports] = useState(initialReports);
  const [focus, setFocus] = useState<MarketFocus>("all");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const active = reports[0];
  const xiaohongshuSignals = active?.xiaohongshuSignals || [];
  const sourceStatus = active?.sourceStatus || { xiaohongshu: "未配置" as const, note: "历史报告尚未接入公开信号来源，请重新运行市场分析。" };
  const viewCopy: Record<MarketWorkbenchView, { eyebrow: string; title: string; description: string }> = {
    overview: { eyebrow: "Market Command Center", title: "市场策略总览", description: "汇总市场机会、竞争信号和近期行动，让获客、内容与 AIGC 有共同的策略依据。" },
    opportunities: { eyebrow: "Market Opportunities", title: "市场机会分析", description: "聚焦细分市场、目标客户、关键痛点和进入路径。" },
    competitors: { eyebrow: "Competitive Intelligence", title: "竞品与替代方案", description: "记录竞品信号与替代路径，并明确哪些内容仍需验证。" },
    strategy: { eyebrow: "Go-to-Market Strategy", title: "营销策略与行动", description: "把优先市场转化为可执行的验证、内容和获客行动。" }
  };
  const page = viewCopy[view];

  async function runAnalysis() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/agent/analyze-market", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ focus })
      });
      const payload = await response.json().catch(() => null) as MarketAnalysisReport | { error?: string } | null;
      if (!response.ok || !payload || !("id" in payload)) {
        throw new Error(payload && "error" in payload ? payload.error || "市场分析失败" : "市场分析服务暂时不可用");
      }
      setReports((items) => [payload, ...items]);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "市场分析失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">{page.eyebrow}</p>
          <h1>{page.title}</h1>
          <p className="subtle">{page.description}</p>
        </div>
        <div className="actions">
          <select aria-label="选择分析范围" value={focus} onChange={(event) => setFocus(event.target.value as MarketFocus)}>
            {focusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <button className="button" onClick={runAnalysis} disabled={loading}><Sparkles size={17} />{loading ? "分析中" : "运行市场分析"}</button>
        </div>
      </div>

      {view === "overview" ? <section className="grid cols-3">
        <div className="panel stat"><Compass size={20} /><strong>{active?.segments.length || 0}</strong><p className="subtle">已分析细分市场</p></div>
        <div className="panel stat"><Crosshair size={20} /><strong>{active?.segments.filter((item) => item.marketPriority === "P0").length || 0}</strong><p className="subtle">P0 优先市场</p></div>
        <div className="panel stat"><Radar size={20} /><strong>{active?.competitorWatch.length || 0}</strong><p className="subtle">竞品/替代方案关注项</p></div>
        <div className="panel stat"><strong>{xiaohongshuSignals.filter((item) => item.intentLevel !== "低").length}</strong><p className="subtle">公开需求/痛点信号</p></div>
      </section> : null}

      {error ? <p className="run-error market-error"><CircleAlert size={16} />{error}</p> : null}

      {!active ? (
        <section className="panel" style={{ marginTop: 16 }}>
          <h2>开始建立市场判断</h2>
          <p className="subtle">先选择目标市场并运行分析。该模块只使用企业资料与明确标注的待验证假设，不会把推断写成市场事实。</p>
        </section>
      ) : (
        <>
          {view === "overview" ? <section className="panel" style={{ marginTop: 16 }}>
            <div className="report-heading"><div><p className="eyebrow">最新报告</p><h2>{active.title}</h2></div><span className="badge">{new Date(active.createdAt).toLocaleString("zh-CN")}</span></div>
            <p className="subtle">{active.executiveSummary}</p>
            <div className="badge-row">{active.knowledgeCitations.map((citation) => <span className="badge" key={citation}>{citation}</span>)}</div>
          </section> : null}

          {view === "overview" ? <section className="panel" style={{ marginTop: 16 }}>
            <div className="report-heading"><div><p className="eyebrow">Xiaohongshu Public Signals</p><h2>公开需求与痛点信号</h2></div><span className="badge">{sourceStatus.xiaohongshu}</span></div>
            <p className="subtle">{sourceStatus.note}</p>
            <div className="signal-list">{xiaohongshuSignals.length ? xiaohongshuSignals.slice(0, 4).map((signal) => <article className="signal-card" key={signal.id}><div className="report-heading"><div><h3>{signal.accountName} <span className="subtle">· {signal.accountType}</span></h3><a href={signal.noteUrl} target="_blank" rel="noreferrer">{signal.title}</a></div><span className="badge">{signal.intentLevel}意向</span></div><p><strong>{signal.signalType}：</strong>{signal.excerpt}</p><p><strong>推荐动作：</strong>{signal.recommendedAction}</p><div className="signal-meta"><a href={signal.profileUrl} target="_blank" rel="noreferrer">主页链接</a><span>{signal.publishedAt}</span></div></article>) : <p className="empty">当前没有本地公开信号样本。</p>}</div>
            <p className="subtle" style={{ marginTop: 14 }}>仅处理公开内容；触达前必须人工核验账号主体、真实需求和平台合规要求。</p>
          </section> : null}

          {(view === "overview" || view === "opportunities") ? <section className="panel" style={{ marginTop: 16 }}>
            <h2>市场机会与进入路径</h2>
            <div className="market-segment-grid">
              {active.segments.map((segment) => (
                <article className="market-segment-card" key={segment.id}>
                  <div className="report-heading"><h3>{segment.name}</h3><div className="badge-row"><span className="badge grade-B">{segment.marketPriority}</span><span className={labelClass(segment.evidenceLabel)}>{segment.evidenceLabel}</span></div></div>
                  <p><strong>目标客户：</strong>{segment.typicalCustomers.join("、")}</p>
                  <p><strong>需求驱动：</strong>{segment.demandDrivers.join("、")}</p>
                  <p><strong>关键痛点：</strong>{segment.painPoints.join("、")}</p>
                  <p><strong>产品匹配：</strong>{segment.productFit}</p>
                  <p><strong>进入建议：</strong>{segment.recommendedEntry}</p>
                  <p className="subtle"><strong>证据：</strong>{segment.evidence.length ? segment.evidence.join("；") : "尚无直接企业知识命中，需补充资料或公开市场证据。"}</p>
                  <div className="market-open-questions"><CircleAlert size={15} /><span>{segment.openQuestions.join("；")}</span></div>
                </article>
              ))}
            </div>
          </section> : null}

          {(view === "overview" || view === "competitors" || view === "strategy") ? <section className={view === "overview" ? "grid cols-2" : "market-detail-grid"} style={{ marginTop: 16 }}>
            {(view === "overview" || view === "competitors") ? <div className="panel">
              <h2>竞品与替代方案关注</h2>
              <div className="timeline">
                {active.competitorWatch.map((item) => <div className="timeline-item" key={item.category}><div className="report-heading"><h3>{item.category}</h3><span className={labelClass(item.evidenceLabel)}>{item.evidenceLabel}</span></div><p>{item.marketSignal}</p><p className="subtle">对我方意味着：{item.implication}</p></div>)}
              </div>
            </div> : null}
            {(view === "overview" || view === "strategy") ? <div className="panel">
              <h2>30 天建议动作</h2>
              <ol className="market-actions">{active.recommendedActions.map((item) => <li key={item}>{item}</li>)}</ol>
              <h3 style={{ marginTop: 20 }}>待确认问题</h3>
              <ul className="market-actions">{active.openQuestions.map((item) => <li key={item}>{item}</li>)}</ul>
            </div> : null}
          </section> : null}
        </>
      )}
    </>
  );
}
