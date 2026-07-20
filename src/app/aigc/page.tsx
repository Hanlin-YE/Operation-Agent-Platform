import { AigcCreationWorkbench } from "@/components/content/AigcCreationWorkbench";
import { ContentStrategyWorkbench } from "@/components/content/ContentStrategyWorkbench";
import { VideoAnalysisWorkbench } from "@/components/content/VideoAnalysisWorkbench";
import { FileText, FolderOpen, ImageIcon, Video, ScanSearch } from "lucide-react";

const contentTypes = [
  { key: "strategy", title: "内容策略", description: "选题、灵感、对标拆解与审核", icon: ScanSearch },
  { key: "text", title: "文本生成", description: "选题、图文文案与短视频脚本", icon: FileText },
  { key: "image", title: "图片生成", description: "风格首帧与视觉资产", icon: ImageIcon },
  { key: "video", title: "视频生成", description: "分镜、首帧与视频任务", icon: Video },
  { key: "all", title: "内容一览", description: "全部创作任务与生成记录", icon: FolderOpen }
];

export default function AigcCreationPage({ searchParams }: { searchParams?: { type?: string } }) {
  const selectedType = contentTypes.some((item) => item.key === searchParams?.type) ? searchParams?.type! : "all";
  const selected = contentTypes.find((item) => item.key === selectedType) ?? contentTypes[4];
  const SelectedIcon = selected.icon;
  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">AIGC Creation</p>
          <h1>AI 内容中心</h1>
          <p className="subtle">先完成选题与内容策略，再进入文本、图片和视频生产；所有阶段共享可追踪的审核记录。</p>
        </div>
      </div>
      <nav className="aigc-content-nav" aria-label="AI 内容类型">
        {contentTypes.map((item) => {
          const Icon = item.icon;
          return <a key={item.key} className={item.key === selectedType ? "active" : ""} href={item.key === "all" ? "/aigc" : `/aigc?type=${item.key}`}><Icon size={17} /><span><strong>{item.title}</strong><small>{item.description}</small></span></a>;
        })}
      </nav>
      {selectedType === "text" ? <AigcCreationWorkbench /> : null}
      {selectedType === "strategy" ? <ContentStrategyWorkbench /> : null}
      {selectedType === "image" ? <section className="content-type-notice panel"><SelectedIcon size={19} /><div><p className="eyebrow">图片生产工作台</p><h2>使用已确认的视觉资产继续生产</h2><p className="subtle">图片生成只承接已审核的内容策略与视觉资产，不在这里重复录入自然语言需求。请先在“文本生成”或“内容策略”完成需求确认。</p></div><a className="button secondary" href="/aigc?type=strategy">查看内容策略</a></section> : null}
      {selectedType === "video" ? <VideoAnalysisWorkbench /> : null}
      {selectedType === "all" ? <section className="content-type-notice panel"><SelectedIcon size={19} /><div><p className="eyebrow">内容任务总览</p><h2>先定策略，再进入生产</h2><p className="subtle">内容策略负责选题和灵感；文本生成接收自然语言需求；图片与视频只消费已确认的内容资产与策略结果。</p></div><a className="button secondary" href="/aigc?type=strategy">开始内容策略</a></section> : null}
    </>
  );
}
