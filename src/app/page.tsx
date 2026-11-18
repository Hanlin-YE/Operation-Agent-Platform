import { DailyFollowUps } from "@/components/leads/DailyFollowUps";
import { readData } from "@/server/data/store";
import { getDailyWork, salesTimeZone } from "@/lib/sales/dailyWork";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const data = await readData();
  const now = new Date();
  const work = getDailyWork(data.leads, data.followUps, now);
  const date = now.toLocaleDateString("zh-CN", { timeZone: salesTimeZone, month: "long", day: "numeric", weekday: "long" });
  return <>
    <div className="page-head"><div><p className="eyebrow">销售工作台 · {date}</p><h1>今日待跟进</h1><p className="subtle">先处理逾期和今天到期的任务，再进入客户线索，完成评分、话术确认与跟进。任务日期按北京时间显示。</p></div><a className="button" href="/leads">进入线索管理</a></div>
    <div className="grid cols-2">
      <DailyFollowUps title="逾期跟进" items={work.overdue} />
      <DailyFollowUps title="今天到期" items={work.today} />
      <DailyFollowUps title="未安排日期的跟进" items={work.unscheduled} />
      <section className="panel"><h2>尚未建立跟进任务 <span className="badge">{work.unplannedLeads.length}</span></h2>{work.unplannedLeads.length ? <div className="sales-task-list">{work.unplannedLeads.map((lead) => <article key={lead.id} className="sales-task"><a href={`/leads/${lead.id}`}><strong>{lead.companyName}</strong></a><p className="subtle">{lead.contactName} · {lead.industry}</p><a href={`/leads/${lead.id}`}>查看线索并安排跟进</a></article>)}</div> : <p className="subtle">待跟进线索均已建立任务。</p>}</section>
    </div>
  </>;
}
