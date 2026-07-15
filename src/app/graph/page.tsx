import { KnowledgeGraphViewer } from "@/components/graph/KnowledgeGraphViewer";

export const dynamic = "force-dynamic";

export default function GraphPage() {
  return <><div className="page-head"><div><p className="eyebrow">Neo4j Relationship Graph</p><h1>销售关系图谱</h1><p className="subtle">查看已进入 Neo4j 的客户、联系人、应用场景与产品之间的可追溯关系。</p></div></div><KnowledgeGraphViewer /></>;
}
