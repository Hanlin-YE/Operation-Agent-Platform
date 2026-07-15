import { KnowledgeForm } from "@/components/agent/KnowledgeForm";
import { listKnowledge } from "@/server/repositories/knowledge";

export const dynamic = "force-dynamic";

export default async function KnowledgePage() {
  const knowledge = await listKnowledge();

  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">RAG Asset</p>
          <h1>销售知识库</h1>
          <p className="subtle">沉淀产品手册、选型经验、行业案例和异议处理，让话术更像专业销售。</p>
        </div>
      </div>
      <div className="split">
        <div className="panel">
          <h2>知识条目</h2>
          <div className="grid">
            {knowledge.map((item) => (
              <div key={item.id} className="panel" style={{ boxShadow: "none" }}>
                <div className="badge-row">
                  <span className="badge">{item.type}</span>
                </div>
                <h3 style={{ marginTop: 10 }}>{item.title}</h3>
                <p className="subtle">{item.content}</p>
              </div>
            ))}
          </div>
        </div>
        <KnowledgeForm />
      </div>
    </>
  );
}
