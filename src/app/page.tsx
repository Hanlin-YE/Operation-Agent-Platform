import { ArrowUpRight, Bot } from "lucide-react";
import { listProducts } from "@/server/repositories/products";
import { listKnowledge } from "@/server/repositories/knowledge";
import { readData } from "@/server/data/store";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [products, knowledge, data] = await Promise.all([listProducts(), listKnowledge(), readData()]);

  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">P0 演示闭环</p>
          <h1>电机销售拓客 AIGC Agent</h1>
          <p className="subtle">把线索初筛、产品匹配、专业话术和跟进记录放在同一个销售工作台里。</p>
        </div>
        <a className="button" href="/leads">
          开始处理线索 <ArrowUpRight size={17} />
        </a>
      </div>

      <section className="grid cols-2">
        <div className="panel">
          <h2>今日优先动作</h2>
          <div className="timeline">
            <div className="timeline-item">
              <h3>1. 打开线索列表</h3>
              <p className="subtle">选择一个公司，运行 AI 评分，判断是否值得优先跟进。</p>
            </div>
            <div className="timeline-item">
              <h3>2. 生成专业话术</h3>
              <p className="subtle">按电话、微信、邮件、价格异议或技术确认场景生成可编辑话术。</p>
            </div>
            <div className="timeline-item">
              <h3>3. 保存跟进记录</h3>
              <p className="subtle">把 AI 结果沉淀到客户时间线，后续复盘和优化评分规则。</p>
            </div>
          </div>
        </div>
        <div className="panel">
          <h2>系统资产</h2>
          <div className="grid">
            <p className="subtle">产品资料：{products.length} 条</p>
            <p className="subtle">销售知识：{knowledge.length} 条</p>
            <p className="subtle">跟进记录：{data.followUps.length} 条</p>
            <a className="button secondary" href="/agent">
              <Bot size={17} />
              打开 Agent Studio
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
