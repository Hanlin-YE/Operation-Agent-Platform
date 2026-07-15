import { RagKnowledgeWorkbench } from "@/components/content/RagKnowledgeWorkbench";

export default function ContentKnowledgeLibraryPage() {
  return <>
    <div className="page-head"><div><p className="eyebrow">Evidence-first RAG</p><h1>论文与专利知识库</h1><p className="subtle">内容运营侧的技术证据层。资料在解析、切片与人工审核前不会进入销售话术或产品结论。</p></div></div>
    <RagKnowledgeWorkbench />
  </>;
}
