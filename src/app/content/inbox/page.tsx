import { ArrowUpRight, UploadCloud } from "lucide-react";

export default function ContentInboxPage() {
  return <>
    <div className="page-head"><div><p className="eyebrow">Material Intake</p><h1>内容素材输入</h1><p className="subtle">此模块将承接会议、活动、图片、音视频和文本素材；当前优先完成论文与专利 RAG。</p></div></div>
    <section className="panel content-placeholder"><UploadCloud size={24} /><div><h2>多媒体素材接入待迁移</h2><p className="subtle">功能结构参考“内容运营agent思考”，视觉与交互将统一使用当前企业控制台规范。</p></div><a className="button secondary" href="/content/library">先进入 RAG 知识库 <ArrowUpRight size={16} /></a></section>
  </>;
}
