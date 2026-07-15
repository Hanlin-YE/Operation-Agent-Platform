import { FileSearch } from "lucide-react";

export default function ContentReviewPage() {
  return <>
    <div className="page-head"><div><p className="eyebrow">Evidence Review</p><h1>证据审核</h1><p className="subtle">审核论文、专利、引用片段与对外结论，确保未经确认的内容不会进入获客 Agent。</p></div></div>
    <section className="panel content-placeholder"><FileSearch size={24} /><div><h2>审核队列等待首批 PDF</h2><p className="subtle">收到文件并完成解析后，这里将显示来源、页码、权利要求、OCR 置信度和批准状态。</p></div></section>
  </>;
}
