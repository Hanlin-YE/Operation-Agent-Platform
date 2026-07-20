import { ArrowUpRight, BookOpen, CalendarDays, FileText, Lightbulb, LineChart, PenLine, Sparkles, TrendingUp, Video } from "lucide-react";
import { listAigcJobs } from "@/server/aigc/jobStore";
import { listMarketReports } from "@/server/repositories/marketReports";

export const dynamic = "force-dynamic";

const today = new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric", weekday: "long" }).format(new Date());

export default async function DashboardPage() {
  const [reports, jobs] = await Promise.all([listMarketReports(), listAigcJobs()]);
  const latestReport = reports[0];
  const recentJobs = jobs.slice(0, 3);
  const p0Markets = latestReport?.segments.filter((item) => item.marketPriority === "P0") ?? [];

  return (
    <>
      <section className="home-hero home-hero-v2">
        <div className="home-hero-copy"><p className="eyebrow">Friction X · 运营工作台</p><h1>把今天的内容行动，建立在真实的知识与市场判断上。</h1><p className="subtle">从一个选题开始，贯通企业知识、市场信号、AI 生成与内容运营；每一步都可以回溯。</p><div className="actions"><a className="button" href="/aigc?type=text"><PenLine size={16} />开始创作</a><a className="button secondary" href="/marketing"><TrendingUp size={16} />查看今日市场</a></div></div>
        <div className="home-date-card"><CalendarDays size={18} /><div><span>今日</span><strong>{today}</strong></div><small>运营自动化已就绪</small></div>
      </section>

      <section className="home-information-grid" aria-label="首页核心信息">
        <article className="panel home-plan-panel">
          <div className="home-block-head"><div><p className="eyebrow">自媒体创作计划</p><h2>下一条值得做的内容</h2></div><a href="/aigc?type=text" aria-label="进入文本生成"><ArrowUpRight size={17} /></a></div>
          <div className="plan-highlight"><Lightbulb size={18} /><div><span>推荐选题</span><strong>{p0Markets[0] ? `面向${p0Markets[0].name}的产品价值解读` : "用一个真实场景，解释产品带来的确定性"}</strong><small>{p0Markets[0]?.recommendedEntry || "从产品知识库中提取一个高频客户问题，生成图文与短视频两个版本。"}</small></div></div>
          <div className="idea-entry"><PenLine size={15} /><span>自述灵感</span><em>记录来自销售、客户或现场的内容线索</em><a href="/aigc?type=text">新建</a></div>
        </article>

        <article className="panel home-market-panel">
          <div className="home-block-head"><div><p className="eyebrow">今日市场</p><h2>市场动向与机会</h2></div><a href="/marketing" aria-label="进入市场知识"><ArrowUpRight size={17} /></a></div>
          {latestReport ? <><div className="market-stat"><strong>{p0Markets.length}</strong><span>个 P0 优先市场</span></div><div className="market-signal-list">{latestReport.segments.slice(0, 2).map((segment) => <div key={segment.id}><span className={`priority-dot ${segment.marketPriority.toLowerCase()}`} /><strong>{segment.name}</strong><small>{segment.demandDrivers[0]}</small></div>)}</div></> : <div className="home-empty"><LineChart size={19} /><p>还没有市场分析报告。运行一次分析，让今日选题基于明确的市场信号。</p><a href="/marketing">开始分析</a></div>}
        </article>

        <article className="panel home-record-panel">
          <div className="home-block-head"><div><p className="eyebrow">AI 生成记录</p><h2>最近的创作任务</h2></div><a href="/aigc" aria-label="查看全部生成记录"><ArrowUpRight size={17} /></a></div>
          <div className="record-filter"><button className="active">日</button><button>周</button><button>月</button></div>
          {recentJobs.length ? <div className="record-list">{recentJobs.map((job) => <a href="/aigc" key={job.jobId}><Video size={15} /><span><strong>{job.projectTitle}</strong><small>{new Date(job.createdAt).toLocaleDateString("zh-CN")}</small></span><em>{job.status === "succeeded" ? "已完成" : "进行中"}</em></a>)}</div> : <div className="home-empty compact"><Sparkles size={19} /><p>尚无生成任务</p><a href="/aigc?type=video">创建视频</a></div>}
        </article>
      </section>

      <section className="home-centers-section"><div className="section-heading"><div><p className="eyebrow">工作中心</p><h2>从资产沉淀到内容增长</h2></div></div><div className="center-grid center-grid-v2">
        <a className="center-card" href="/knowledge"><span className="center-icon"><BookOpen size={19} /></span><div><span className="center-kicker">知识资产中心</span><h3>产品与市场知识</h3><p>用 RAG 让每一次创作和销售沟通都有依据。</p></div><ArrowUpRight size={15} /></a>
        <a className="center-card" href="/aigc"><span className="center-icon"><Sparkles size={19} /></span><div><span className="center-kicker">AI 内容中心</span><h3>文本、图片与视频</h3><p>按内容形式进入生成工作流，统一管理生成资产。</p></div><ArrowUpRight size={15} /></a>
        <a className="center-card" href="/content"><span className="center-icon"><FileText size={19} /></span><div><span className="center-kicker">内容运营中心</span><h3>发布、分析与热点</h3><p>把素材、内容表现和用户反馈连成闭环。</p></div><ArrowUpRight size={15} /></a>
      </div></section>
    </>
  );
}
