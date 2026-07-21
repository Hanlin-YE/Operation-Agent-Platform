"use client";

import { useState } from "react";
import { Building2, CircleAlert, FileSearch, LoaderCircle, Search, ShieldCheck, Sparkles } from "lucide-react";
import { MarketAnalysisReport, MarketFocus } from "@/server/data/types";

export type MarketWorkbenchView = "overview" | "opportunities" | "competitors" | "strategy";

type ResearchSubjectType = "competitor" | "customer";
type MarketResearchResult = { subject_name: string; subject_type: ResearchSubjectType; source_url: string; page_title: string; public_excerpt: string; observed_companies: string[]; research_angles: string[]; review_status: "needs_review"; notice: string };
type TianyanCandidate = { companyName: string; companyId?: string; creditCode?: string; status?: string; legalRepresentative?: string };
type TianyanProfile = { companyName: string; registration: { status?: string; legalRepresentative?: string; establishedAt?: string; registeredCapital?: string; location?: string; businessScope?: string }; risk: { summary: string }; source: "天眼 AI" };

const tianyanPriorityIndicators = [
  { name: "主体有效性", source: "工商登记", signal: "经营状态、企业类型、成立日期、注册地址", use: "先排除注销、异常或主体不匹配客户" },
  { name: "规模与采购能力", source: "工商登记/年报", signal: "注册资本、成立年限、联系方式、人员规模", use: "判断是否值得进入重点跟进池" },
  { name: "技术积累", source: "专利/软著/商标", signal: "专利方向、软件著作权、品牌资产", use: "判断是否匹配超滑电机这类技术型产品" },
  { name: "产品与业务方向", source: "企业简介/产品信息", signal: "主营产品、业务分类、公开介绍", use: "识别机器人、医疗、精密设备等应用场景" },
  { name: "资质与证书", source: "经营资质", signal: "行业证书、许可、有效期、证书状态", use: "判断行业准入与技术交付可信度" },
  { name: "招投标需求", source: "招投标", signal: "项目名称、中标情况、采购金额、招标单位", use: "捕捉近期采购动作和潜在需求窗口" },
  { name: "关联网络", source: "股东/对外投资/关系图谱", signal: "股权结构、实控人、关联企业、上下游线索", use: "顺藤摸出集团客户、竞品客户和转介绍路径" },
  { name: "风险健康度", source: "风险总览/司法/行政处罚", signal: "司法案件、被执行、行政处罚、经营异常", use: "避免把销售资源投入高风险主体" }
];

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

function tianyanCompanyUrl(companyId?: string) {
  return companyId ? `https://www.tianyancha.com/company/${companyId}` : undefined;
}

export function MarketAnalysisWorkbench({ initialReports, view = "overview" }: { initialReports: MarketAnalysisReport[]; view?: MarketWorkbenchView }) {
  const [reports, setReports] = useState(initialReports);
  const [focus, setFocus] = useState<MarketFocus>("all");
  const [loading, setLoading] = useState(false);
  const [researching, setResearching] = useState(false);
  const [researchSubjectType, setResearchSubjectType] = useState<ResearchSubjectType>("competitor");
  const [researchResult, setResearchResult] = useState<MarketResearchResult | null>(null);
  const [tianyanQuery, setTianyanQuery] = useState("");
  const [tianyanCandidates, setTianyanCandidates] = useState<TianyanCandidate[]>([]);
  const [tianyanProfile, setTianyanProfile] = useState<TianyanProfile | null>(null);
  const [selectedTianyanCandidate, setSelectedTianyanCandidate] = useState<TianyanCandidate | null>(null);
  const [tianyanLoading, setTianyanLoading] = useState(false);
  const [error, setError] = useState("");
  const active = reports[0];
  const sourceStatus = active?.sourceStatus || { xiaohongshu: "未配置" as const, note: "历史报告尚未接入公开信号来源，请重新运行市场分析。" };
  const xiaohongshuSignals = sourceStatus.xiaohongshu === "本地演示数据" ? [] : active?.xiaohongshuSignals || [];
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

  async function researchPublicPage() {
    setResearching(true); setError(""); setResearchResult(null);
    try {
      const response = await fetch("/api/market-research/crawl", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ subject_type: researchSubjectType }) });
      const payload = await response.json().catch(() => ({})) as MarketResearchResult & { detail?: string; error?: string };
      if (!response.ok) throw new Error(payload.detail || payload.error || "公开页面采集失败");
      setResearchResult(payload);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "公开页面采集失败");
    } finally { setResearching(false); }
  }

  async function searchTianyanCompany() {
    setTianyanLoading(true); setError(""); setTianyanProfile(null); setSelectedTianyanCandidate(null); setTianyanCandidates([]);
    try {
      const response = await fetch("/api/market-intelligence/tianyan", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "search", query: tianyanQuery }) });
      const payload = await response.json().catch(() => ({})) as { candidates?: TianyanCandidate[]; message?: string };
      if (!response.ok) throw new Error(payload.message || "天眼 AI 企业搜索暂时不可用");
      setTianyanCandidates(payload.candidates || []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "天眼 AI 企业搜索暂时不可用");
    } finally { setTianyanLoading(false); }
  }

  async function loadTianyanProfile(candidate: TianyanCandidate) {
    setTianyanLoading(true); setError("");
    try {
      const response = await fetch("/api/market-intelligence/tianyan", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "profile", companyName: candidate.companyName }) });
      const payload = await response.json().catch(() => ({})) as { profile?: TianyanProfile; message?: string };
      if (!response.ok || !payload.profile) throw new Error(payload.message || "天眼 AI 企业情报暂时不可用");
      setSelectedTianyanCandidate(candidate);
      setTianyanProfile(payload.profile);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "天眼 AI 企业情报暂时不可用");
    } finally { setTianyanLoading(false); }
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

      {error ? <p className="run-error market-error"><CircleAlert size={16} />{error}</p> : null}

      {view === "overview" ? <section className="panel market-research-panel" style={{ marginTop: 16 }}>
        <div className="report-heading"><div><p className="eyebrow">Tianyan AI</p><h2>企业市场情报</h2></div><Building2 size={19} /></div>
        <p className="subtle">输入企业全称、简称或统一社会信用代码，先确认主体，再查看基础经营信息与风险总览。查询由本机天眼 AI CLI 发起，可能消耗天眼额度。</p>
        <div className="market-research-form tianyan-search-form">
          <label className="field"><span>企业主体</span><input value={tianyanQuery} onChange={(event) => setTianyanQuery(event.target.value)} placeholder="例如：北京字节跳动科技有限公司" onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); searchTianyanCompany(); } }} /></label>
          <button className="button" onClick={searchTianyanCompany} disabled={tianyanLoading || tianyanQuery.trim().length < 2}>{tianyanLoading ? <LoaderCircle className="spin" size={16} /> : <Search size={16} />}{tianyanLoading ? "查询中" : "搜索企业"}</button>
        </div>
        {tianyanCandidates.length ? <div className="tianyan-candidate-list" aria-label="天眼 AI 企业候选">{tianyanCandidates.map((candidate) => {
          const manualUrl = tianyanCompanyUrl(candidate.companyId);
          return <div className="tianyan-candidate-row" key={candidate.companyId || candidate.creditCode || candidate.companyName}><button type="button" onClick={() => loadTianyanProfile(candidate)} disabled={tianyanLoading}><div><strong>{candidate.companyName}</strong><span>{[candidate.status, candidate.legalRepresentative ? `法定代表人：${candidate.legalRepresentative}` : undefined].filter(Boolean).join(" · ") || "待核验"}</span></div><small>查看情报</small></button>{manualUrl ? <a className="tianyan-manual-link" href={manualUrl} target="_blank" rel="noreferrer">人工打开</a> : null}</div>;
        })}</div> : null}
        {tianyanProfile ? <article className="tianyan-profile"><div className="report-heading"><div><strong>{tianyanProfile.companyName}</strong><p>{tianyanProfile.source} · 已确认主体</p></div><div className="badge-row"><span className="badge grade-B">需人工核验</span>{tianyanCompanyUrl(selectedTianyanCandidate?.companyId) ? <a className="badge tianyan-profile-link" href={tianyanCompanyUrl(selectedTianyanCandidate?.companyId)} target="_blank" rel="noreferrer">天眼查页面</a> : null}</div></div><div className="tianyan-profile-grid"><div><span>登记状态</span><strong>{tianyanProfile.registration.status || "未返回"}</strong></div><div><span>法定代表人</span><strong>{tianyanProfile.registration.legalRepresentative || "未返回"}</strong></div><div><span>成立时间</span><strong>{tianyanProfile.registration.establishedAt || "未返回"}</strong></div><div><span>注册资本</span><strong>{tianyanProfile.registration.registeredCapital || "未返回"}</strong></div><div><span>注册地</span><strong>{tianyanProfile.registration.location || "未返回"}</strong></div></div><p className="tianyan-risk"><ShieldCheck size={15} /><span>{tianyanProfile.risk.summary}</span></p>{tianyanProfile.registration.businessScope ? <p className="tianyan-scope"><strong>经营范围：</strong>{tianyanProfile.registration.businessScope}</p> : null}</article> : null}
        <div className="tianyan-indicator-table" aria-label="企业情报优先指标">
          <div className="tianyan-indicator-row tianyan-indicator-head"><span>优先指标</span><span>数据来源</span><span>关键信号</span><span>销售判断</span></div>
          {tianyanPriorityIndicators.map((indicator) => <div className="tianyan-indicator-row" key={indicator.name}><strong>{indicator.name}</strong><span>{indicator.source}</span><span>{indicator.signal}</span><span>{indicator.use}</span></div>)}
        </div>
      </section> : null}

      {view === "overview" ? <section className="panel market-research-panel" style={{ marginTop: 16 }}>
        <div className="report-heading"><div><p className="eyebrow">Public Web Research</p><h2>竞品／潜在客户公开信息采集</h2></div><FileSearch size={19} /></div>
        <p className="subtle">选择调查类型后即可启动采集。系统仅从管理员配置的公开来源读取信息，不登录、不保存 Cookie 或下载内容；结果必须人工核验。</p>
        <div className="market-research-form">
          <label className="field"><span>调查类型</span><select value={researchSubjectType} onChange={(event) => setResearchSubjectType(event.target.value as ResearchSubjectType)}><option value="competitor">竞品动态</option><option value="customer">潜在客户</option></select></label>
          <button className="button" onClick={researchPublicPage} disabled={researching}>{researching ? <LoaderCircle className="spin" size={16} /> : <FileSearch size={16} />}{researching ? "采集中" : "启动采集"}</button>
        </div>
        {researchResult ? <article className="market-research-result"><div className="report-heading"><div><strong>{researchResult.subject_name}</strong><p>{researchResult.subject_type === "competitor" ? "潜在竞品" : "潜在客户"} · {researchResult.page_title}</p></div><span className="badge grade-C">待人工核验</span></div><p>{researchResult.public_excerpt || "页面未提取到可用正文，请人工打开原始链接核对。"}</p><div className="badge-row">{researchResult.research_angles.map((angle) => <span className="badge" key={angle}>{angle}</span>)}{researchResult.observed_companies.map((company) => <span className="badge" key={company}>页面提及：{company}</span>)}</div><a className="market-research-source" href={researchResult.source_url} target="_blank" rel="noreferrer">查看原始公开页面</a><small><ShieldCheck size={14} />{researchResult.notice}</small></article> : null}
      </section> : null}

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
            <div className="signal-list">{xiaohongshuSignals.length ? xiaohongshuSignals.slice(0, 4).map((signal) => <article className="signal-card" key={signal.id}><div className="report-heading"><div><h3>{signal.accountName} <span className="subtle">· {signal.accountType}</span></h3><a href={signal.noteUrl} target="_blank" rel="noreferrer">{signal.title}</a></div><span className="badge">{signal.intentLevel}意向</span></div><p><strong>{signal.signalType}：</strong>{signal.excerpt}</p><p><strong>推荐动作：</strong>{signal.recommendedAction}</p><div className="signal-meta"><a href={signal.noteUrl} target="_blank" rel="noreferrer">原始笔记</a>{signal.profileUrl ? <a href={signal.profileUrl} target="_blank" rel="noreferrer">账号主页</a> : null}<span>来源：{signal.sourceName || "未提供"}</span><span>抓取时间：{signal.collectedAt ? new Date(signal.collectedAt).toLocaleString("zh-CN") : "未提供"}</span><span>来源状态：{signal.sourceStatus || "待来源核验"}</span></div></article>) : <p className="empty">当前没有可追溯的公开信号。配置授权数据源后重新运行市场分析即可获取带原始链接和抓取时间的记录。</p>}</div>
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
