import { ArrowUpRight, CalendarDays, Lightbulb, LineChart } from "lucide-react";
import { HomeInspirationNotebook } from "@/components/home/HomeInspirationNotebook";
import { AigcShowcaseBoard } from "@/components/home/AigcShowcaseBoard";
import { listMarketReports } from "@/server/repositories/marketReports";

export const dynamic = "force-dynamic";

const today = new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric", weekday: "long" }).format(new Date());

export default async function DashboardPage() {
  const reports = await listMarketReports();
  const latestReport = reports[0];
  const p0Markets = latestReport?.segments.filter((item) => item.marketPriority === "P0") ?? [];

  return (
    <>
      <section className="home-hero home-hero-v2">
        <div className="home-hero-copy"><p className="eyebrow">Friction X · 运营工作台</p><h1>把今天的内容行动，建立在真实的知识与市场判断上。</h1><p className="subtle">从一个选题开始，贯通企业知识、市场信号、AI 生成与内容运营；每一步都可以回溯。</p></div>
        <div className="home-date-card"><CalendarDays size={18} /><div><span>今日</span><strong>{today}</strong></div><small>运营自动化已就绪</small></div>
      </section>

      <section className="home-information-grid" aria-label="首页核心信息">
        <article className="panel home-plan-panel">
          <div className="home-block-head"><div><p className="eyebrow">自媒体创作</p></div><a href="/aigc?type=text" aria-label="进入文本生成"><ArrowUpRight size={17} /></a></div>
          <div className="plan-highlight"><Lightbulb size={18} /><div><span>推荐选题</span><strong>{p0Markets[0] ? `面向${p0Markets[0].name}的产品价值解读` : "用一个真实场景，解释产品带来的确定性"}</strong><small>{p0Markets[0]?.recommendedEntry || "从产品知识库中提取一个高频客户问题，生成图文与短视频两个版本。"}</small></div></div>
          <HomeInspirationNotebook />
        </article>

        <article className="panel home-market-panel">
          <div className="home-block-head"><div><p className="eyebrow">今日市场</p><h2>市场动向与机会</h2></div><a href="/marketing" aria-label="进入市场知识"><ArrowUpRight size={17} /></a></div>
          {latestReport ? <><div className="market-stat"><strong>{p0Markets.length}</strong><span>个 P0 优先市场</span></div><div className="market-signal-list">{latestReport.segments.slice(0, 2).map((segment) => <div key={segment.id}><span className={`priority-dot ${segment.marketPriority.toLowerCase()}`} /><strong>{segment.name}</strong><small>{segment.demandDrivers[0]}</small></div>)}</div></> : <div className="home-empty"><LineChart size={19} /><p>还没有市场分析报告。运行一次分析，让今日选题基于明确的市场信号。</p><a href="/marketing">开始分析</a></div>}
        </article>

      </section>

      <AigcShowcaseBoard />
    </>
  );
}
