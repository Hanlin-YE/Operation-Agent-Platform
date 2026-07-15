import { Bot, Database, Gauge, MessageSquareText } from "lucide-react";
import { listLeads } from "@/server/repositories/leads";

export const dynamic = "force-dynamic";

export default async function AgentStudioPage() {
  const leads = await listLeads();

  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">Agent Studio</p>
          <h1>销售 Agent 编排台</h1>
          <p className="subtle">P0 采用固定销售流程，先保证可演示、可复盘，再扩展为可配置流程。</p>
        </div>
      </div>

      <section className="grid cols-3">
        <div className="panel stat">
          <Database size={20} />
          <strong>1</strong>
          <p className="subtle">线索画像输入</p>
        </div>
        <div className="panel stat">
          <Gauge size={20} />
          <strong>2</strong>
          <p className="subtle">潜客评分与解释</p>
        </div>
        <div className="panel stat">
          <MessageSquareText size={20} />
          <strong>3</strong>
          <p className="subtle">专业话术生成</p>
        </div>
      </section>

      <section className="panel" style={{ marginTop: 16 }}>
        <h2>固定执行流程</h2>
        <div className="timeline">
          <div className="timeline-item">
            <h3>Lead Context Loader</h3>
            <p className="subtle">读取公司、行业、联系人、标签、备注等线索上下文。</p>
          </div>
          <div className="timeline-item">
            <h3>Lead Scoring Agent</h3>
            <p className="subtle">按照行业、应用场景、采购能力、触达角色、紧迫度和风险扣分生成评分。</p>
          </div>
          <div className="timeline-item">
            <h3>Sales RAG Retriever</h3>
            <p className="subtle">从产品库和知识库中检索最相关的电机资料、选型经验和异议处理 SOP。</p>
          </div>
          <div className="timeline-item">
            <h3>Pitch Generation Agent</h3>
            <p className="subtle">按电话、微信、邮件、报价后跟进、价格异议、技术确认生成可编辑话术。</p>
          </div>
        </div>
      </section>

      <section className="panel" style={{ marginTop: 16 }}>
        <h2>快速进入线索</h2>
        <div className="badge-row">
          {leads.map((lead) => (
            <a className="badge" key={lead.id} href={`/leads/${lead.id}`}>
              <Bot size={12} /> {lead.companyName}
            </a>
          ))}
        </div>
      </section>
    </>
  );
}
