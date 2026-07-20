import { KnowledgeForm } from "@/components/agent/KnowledgeForm";
import { listKnowledge } from "@/server/repositories/knowledge";

export const dynamic = "force-dynamic";

export default async function KnowledgePage() {
  const knowledge = await listKnowledge();

  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">Knowledge Workspace</p>
          <h1>产品信息知识库</h1>
          <p className="subtle">在一个输入框里沉淀产品、市场与销售经验；需要维护时，再从设置中管理已有知识。</p>
        </div>
      </div>
      <KnowledgeForm knowledge={knowledge} />
    </>
  );
}
