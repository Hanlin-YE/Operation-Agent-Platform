import { AigcCreationWorkbench } from "@/components/content/AigcCreationWorkbench";
import { FileText, FolderOpen, ImageIcon, Video } from "lucide-react";

const contentTypes = [
  { key: "text", title: "文本生成", description: "选题、图文文案与短视频脚本", icon: FileText },
  { key: "image", title: "图片生成", description: "风格首帧与视觉资产", icon: ImageIcon },
  { key: "video", title: "视频生成", description: "分镜、首帧与视频任务", icon: Video },
  { key: "all", title: "内容一览", description: "全部创作任务与生成记录", icon: FolderOpen }
];

export default function AigcCreationPage({ searchParams }: { searchParams?: { type?: string } }) {
  const selectedType = contentTypes.some((item) => item.key === searchParams?.type) ? searchParams?.type! : "all";
  const selected = contentTypes.find((item) => item.key === selectedType) ?? contentTypes[3];
  const SelectedIcon = selected.icon;
  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">AIGC Creation</p>
          <h1>AI 内容中心</h1>
          <p className="subtle">按内容形式进入创作任务。文本、图片与视频共享企业知识、市场判断和可追踪的生成记录。</p>
        </div>
      </div>
      <nav className="aigc-content-nav" aria-label="AI 内容类型">
        {contentTypes.map((item) => {
          const Icon = item.icon;
          return <a key={item.key} className={item.key === selectedType ? "active" : ""} href={item.key === "all" ? "/aigc" : `/aigc?type=${item.key}`}><Icon size={17} /><span><strong>{item.title}</strong><small>{item.description}</small></span></a>;
        })}
      </nav>
      {selectedType !== "video" && selectedType !== "all" ? <section className="content-type-notice panel"><SelectedIcon size={19} /><div><p className="eyebrow">{selected.title}</p><h2>以企业知识与市场洞察为创作上下文</h2><p className="subtle">该内容类型已纳入统一导航。当前可先通过“视频生成”完成资产锁定与生成任务；文本和图片的专用生成器将在同一记录中心接入。</p></div><a className="button secondary" href="/aigc?type=video">打开视频生成</a></section> : null}
      <AigcCreationWorkbench />
    </>
  );
}
