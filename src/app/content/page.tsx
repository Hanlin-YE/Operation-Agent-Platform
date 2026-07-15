import { ArrowUpRight, FileSearch, Files, UploadCloud } from "lucide-react";

export default function ContentOperationsPage() {
  return <>
    <div className="page-head"><div><p className="eyebrow">Content Operations</p><h1>内容运营 Agent</h1><p className="subtle">把原始素材、论文、专利和可发布内容组织成可追溯、可审核的知识生产流程。</p></div><a className="button" href="/content/library">打开论文与专利 RAG <ArrowUpRight size={17} /></a></div>
    <section className="content-flow panel" aria-label="内容运营工作流">
      <div><UploadCloud size={18} /><span><strong>01 · 素材进入</strong><small>会议、活动、PDF 与内容资料</small></span></div>
      <i />
      <div><Files size={18} /><span><strong>02 · 结构化知识</strong><small>来源、切片、元数据与向量</small></span></div>
      <i />
      <div><FileSearch size={18} /><span><strong>03 · 证据审核</strong><small>引用、事实与发布边界</small></span></div>
    </section>
    <section className="grid cols-2 content-entry-grid">
      <a className="panel content-entry" href="/content/inbox"><UploadCloud size={20} /><div><h2>素材输入</h2><p className="subtle">承接内容运营 Agent 原型中的多媒体输入、识别与报告工作流。</p></div><ArrowUpRight size={17} /></a>
      <a className="panel content-entry" href="/content/library"><Files size={20} /><div><h2>论文与专利 RAG</h2><p className="subtle">登记 PDF，建立来源、Chunk、Embedding、引用与审核记录。</p></div><ArrowUpRight size={17} /></a>
    </section>
  </>;
}
