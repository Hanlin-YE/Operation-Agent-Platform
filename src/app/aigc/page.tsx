import { AigcCreationWorkbench } from "@/components/content/AigcCreationWorkbench";

export default function AigcCreationPage() {
  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">AIGC Creation</p>
          <h1>AIGC 创作 Agent</h1>
          <p className="subtle">把一句自然语言需求封装成可审批、可提交、可追踪的创作任务，作为接入外部视频平台前的控制层。</p>
        </div>
      </div>
      <AigcCreationWorkbench />
    </>
  );
}
