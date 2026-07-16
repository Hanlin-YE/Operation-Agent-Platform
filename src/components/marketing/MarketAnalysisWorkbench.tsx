"use client";

import { useState } from "react";
import {
  CheckSquare,
  CircleAlert,
  Compass,
  Crosshair,
  Radar,
  Search,
  Sparkles,
  Target
} from "lucide-react";
import { MarketAnalysisReport, MarketFocus } from "@/server/data/types";

const focusOptions: Array<{ value: MarketFocus; label: string }> = [
  { value: "all", label: "全市场机会" },
  { value: "robotics", label: "人形机器人与灵巧手" },
  { value: "medical", label: "医疗精密设备" },
  { value: "industrial", label: "工业自动化" },
  { value: "automotive", label: "汽车电子" },
  { value: "aerospace", label: "无人机与航空航天" }
];

type Workspace = "opportunity" | "signals" | "competition" | "actions";

function labelClass(label: string) {
  if (label === "企业知识") return "badge grade-A";
  if (label === "待市场验证") return "badge grade-C";
  return "badge";
}

function intentClass(intent: string) {
  if (intent === "高") return "badge grade-A";
  if (intent === "中") return "badge grade-B";
  return "badge grade-C";
}

export function MarketAnalysisWorkbench({ initialReports }: { initialReports: MarketAnalysisReport[] }) {
  const [reports, setReports] = useState(initialReports);
  const [focus, setFocus] = useState<MarketFocus>("all");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [workspace, setWorkspace] = useState<Workspace>("opportunity");
  const active = reports[0];

  // 兼容接入小红书 Skill 前已经持久化的旧报告。
  const xiaohongshuSignals = active?.xiaohongshuSignals || [];
  const sourceStatus = active?.sourceStatus || {
    xiaohongshu: "未配置" as const,
    note: "该历史报告生成时尚未接入小红书 Skill。请重新运行市场分析以生成本地演示信号。"
  };

  async function runAnalysis() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/agent/analyze-market", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ focus })
      });
      if (!response.ok) throw new Error("市场分析请求失败，请稍后重试。");
      const report = await response.json() as MarketAnalysisReport;
      setReports((items) => [report, ...items]);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "市场分析请求失败，请稍后重试。");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">Marketing Intelligence</p>
          <h1>市场分析与营销决策</h1>
          <p className="subtle">为没有专职市场部的技术型企业，建立“机会判断—公开信号—竞争态势—行动闭环”。</p>
        </div>
        <div className="actions">
          <select aria-label="选择分析范围" value={focus} onChange={(event) => setFocus(event.target.value as MarketFocus)}>
            {focusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <button className="button" onClick={runAnalysis} disabled={loading}>
            <Sparkles size={17} />{loading ? "分析中" : "运行市场分析"}
          </button>
        </div>
      </div>

      {error && <div className="market-open-questions"><CircleAlert size={15} /><span>{error}</span></div>}

      <section className="grid cols-3">
        <div className="panel stat"><Compass size={20} /><strong>{active?.segments.length || 0}</strong><p className="subtle">已分析细分市场</p></div>
        <div className="panel stat"><Crosshair size={20} /><strong>{active?.segments.filter((item) => item.marketPriority === "P0").length || 0}</strong><p className="subtle">P0 优先市场</p></div>
        <div className="panel stat"><Search size={20} /><strong>{xiaohongshuSignals.filter((item) => item.intentLevel !== "低").length}</strong><p className="subtle">公开需求/痛点信号</p></div>
      </section>

      {!active ? (
        <section className="panel" style={{ marginTop: 16 }}>
          <h2>开始建立市场判断</h2>
          <p className="subtle">先选择目标市场并运行分析。所有未经企业资料或公开资料验证的结论都会保留“推断/待市场验证”标记。</p>
        </section>
      ) : (
        <>
          <section className="panel" style={{ marginTop: 16 }}>
            <div className="report-heading">
              <div><p className="eyebrow">最新报告</p><h2>{active.title}</h2></div>
              <span className="badge">{new Date(active.createdAt).toLocaleString("zh-CN")}</span>
            </div>
            <p className="subtle">{active.executiveSummary}</p>
            <div className="badge-row">{active.knowledgeCitations.map((citation) => <span className="badge" key={citation}>{citation}</span>)}</div>
          </section>

          <section className="market-workflows" aria-label="市场分析工作流">
            <button className={workspace === "opportunity" ? "market-workflow active" : "market-workflow"} onClick={() => setWorkspace("opportunity")}>
              <Compass size={18} /><span>01 市场机会</span><small>细分市场、客户与进入路径</small>
            </button>
            <button className={workspace === "signals" ? "market-workflow active" : "market-workflow"} onClick={() => setWorkspace("signals")}>
              <Search size={18} /><span>02 小红书公开信号</span><small>需求、痛点与评论线索</small>
            </button>
            <button className={workspace === "competition" ? "market-workflow active" : "market-workflow"} onClick={() => setWorkspace("competition")}>
              <Radar size={18} /><span>03 竞争与替代</span><small>竞品观察与验证假设</small>
            </button>
            <button className={workspace === "actions" ? "market-workflow active" : "market-workflow"} onClick={() => setWorkspace("actions")}>
              <CheckSquare size={18} /><span>04 营销行动闭环</span><small>30 天动作与待确认事项</small>
            </button>
          </section>

          {workspace === "opportunity" && (
            <section className="panel">
              <div className="report-heading"><div><p className="eyebrow">01 · Opportunity scan</p><h2>市场机会与进入路径</h2></div><Target size={20} /></div>
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
          )}

          {workspace === "signals" && (
            <section className="panel">
              <div className="report-heading"><div><p className="eyebrow">02 · Xiaohongshu signal skill</p><h2>小红书公开需求与痛点信号</h2></div><span className="badge">{sourceStatus.xiaohongshu}</span></div>
              <p className="subtle">{sourceStatus.note}</p>
              <div className="signal-list">
                {xiaohongshuSignals.length ? xiaohongshuSignals.map((signal) => (
                  <article className="signal-card" key={signal.id}>
                    <div className="report-heading">
                      <div><h3>{signal.accountName} <span className="subtle">· {signal.accountType}</span></h3><a href={signal.noteUrl} target="_blank" rel="noreferrer">{signal.title}</a></div>
                      <div className="badge-row"><span className={intentClass(signal.intentLevel)}>{signal.intentLevel}意向</span><span className={labelClass(signal.evidenceLabel)}>{signal.evidenceLabel}</span></div>
                    </div>
                    <p><strong>{signal.signalType}：</strong>{signal.excerpt}</p>
                    <p><strong>推荐动作：</strong>{signal.recommendedAction}</p>
                    <div className="signal-meta"><a href={signal.profileUrl} target="_blank" rel="noreferrer">主页链接</a><span>{signal.publishedAt}</span><span>{signal.scenario}</span></div>
                  </article>
                )) : <p className="empty">当前筛选范围没有本地公开信号样本；真实来源尚未配置。</p>}
              </div>
              <p className="subtle" style={{ marginTop: 14 }}>仅处理公开内容。任何触达前，需人工核验账号主体、真实需求和平台合规要求。</p>
            </section>
          )}

          {workspace === "competition" && (
            <section className="panel">
              <div className="report-heading"><div><p className="eyebrow">03 · Competitive landscape</p><h2>竞品与替代方案关注</h2></div><Radar size={20} /></div>
              <div className="timeline">
                {active.competitorWatch.map((item) => <div className="timeline-item" key={item.category}><div className="report-heading"><h3>{item.category}</h3><span className={labelClass(item.evidenceLabel)}>{item.evidenceLabel}</span></div><p>{item.marketSignal}</p><p className="subtle">对我方意味着：{item.implication}</p></div>)}
              </div>
              <div className="market-open-questions" style={{ marginTop: 18 }}><CircleAlert size={15} /><span>这是竞争情报待办清单，不是竞品事实库；价格、性能和客户关系必须补充可追溯公开证据或企业授权资料。</span></div>
            </section>
          )}

          {workspace === "actions" && (
            <section className="grid cols-2">
              <div className="panel"><p className="eyebrow">04 · 30-day plan</p><h2>30 天营销动作</h2><ol className="market-actions">{active.recommendedActions.map((item) => <li key={item}>{item}</li>)}</ol></div>
              <div className="panel"><p className="eyebrow">Review gate</p><h2>待确认问题</h2><ul className="market-actions">{active.openQuestions.map((item) => <li key={item}>{item}</li>)}</ul><p className="subtle" style={{ marginTop: 16 }}>完成上述核验后，再把高意向公开信号转入获客 Agent，避免将市场推断直接当成销售结论。</p></div>
            </section>
          )}
        </>
      )}
    </>
  );
}
