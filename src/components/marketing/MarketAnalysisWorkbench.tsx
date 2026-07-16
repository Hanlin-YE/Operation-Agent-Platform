"use client";

import { useState } from "react";
import { BarChart3, CircleAlert, Compass, Crosshair, Radar, Sparkles } from "lucide-react";
import { MarketAnalysisReport, MarketFocus } from "@/server/data/types";

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

export function MarketAnalysisWorkbench({ initialReports }: { initialReports: MarketAnalysisReport[] }) {
  const [reports, setReports] = useState(initialReports);
  const [focus, setFocus] = useState<MarketFocus>("all");
  const [loading, setLoading] = useState(false);
  const active = reports[0];

  async function runAnalysis() {
    setLoading(true);
    const response = await fetch("/api/agent/analyze-market", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ focus })
    });
    const report = await response.json() as MarketAnalysisReport;
    setReports((items) => [report, ...items]);
    setLoading(false);
  }

  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">Marketing Intelligence</p>
          <h1>市场分析与营销决策</h1>
          <p className="subtle">为没有专职市场部的技术型企业，输出市场机会、客户画像、竞品关注与可执行的进入策略。</p>
        </div>
        <div className="actions">
          <select aria-label="选择分析范围" value={focus} onChange={(event) => setFocus(event.target.value as MarketFocus)}>
            {focusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <button className="button" onClick={runAnalysis} disabled={loading}><Sparkles size={17} />{loading ? "分析中" : "运行市场分析"}</button>
        </div>
      </div>

      <section className="grid cols-3">
        <div className="panel stat"><Compass size={20} /><strong>{active?.segments.length || 0}</strong><p className="subtle">已分析细分市场</p></div>
        <div className="panel stat"><Crosshair size={20} /><strong>{active?.segments.filter((item) => item.marketPriority === "P0").length || 0}</strong><p className="subtle">P0 优先市场</p></div>
        <div className="panel stat"><Radar size={20} /><strong>{active?.competitorWatch.length || 0}</strong><p className="subtle">竞品/替代方案关注项</p></div>
      </section>

      {!active ? (
        <section className="panel" style={{ marginTop: 16 }}>
          <h2>开始建立市场判断</h2>
          <p className="subtle">先选择目标市场并运行分析。该模块只使用企业资料与明确标注的待验证假设，不会把推断写成市场事实。</p>
        </section>
      ) : (
        <>
          <section className="panel" style={{ marginTop: 16 }}>
            <div className="report-heading"><div><p className="eyebrow">最新报告</p><h2>{active.title}</h2></div><span className="badge">{new Date(active.createdAt).toLocaleString("zh-CN")}</span></div>
            <p className="subtle">{active.executiveSummary}</p>
            <div className="badge-row">{active.knowledgeCitations.map((citation) => <span className="badge" key={citation}>{citation}</span>)}</div>
          </section>

          <section className="panel" style={{ marginTop: 16 }}>
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
          </section>

          <section className="grid cols-2" style={{ marginTop: 16 }}>
            <div className="panel">
              <h2>竞品与替代方案关注</h2>
              <div className="timeline">
                {active.competitorWatch.map((item) => <div className="timeline-item" key={item.category}><div className="report-heading"><h3>{item.category}</h3><span className={labelClass(item.evidenceLabel)}>{item.evidenceLabel}</span></div><p>{item.marketSignal}</p><p className="subtle">对我方意味着：{item.implication}</p></div>)}
              </div>
            </div>
            <div className="panel">
              <h2>30 天建议动作</h2>
              <ol className="market-actions">{active.recommendedActions.map((item) => <li key={item}>{item}</li>)}</ol>
              <h3 style={{ marginTop: 20 }}>待确认问题</h3>
              <ul className="market-actions">{active.openQuestions.map((item) => <li key={item}>{item}</li>)}</ul>
            </div>
          </section>
        </>
      )}
    </>
  );
}
