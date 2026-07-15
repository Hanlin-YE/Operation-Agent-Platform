import { RunsWorkbench } from "@/components/agent/RunsWorkbench";

export default function AgentRunsPage() {
  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">Operations Agent</p>
          <h1>任务控制台</h1>
          <p className="subtle">在同一处完成运营任务创建、自动采集进度跟踪与人工审核确认。</p>
        </div>
      </div>
      <RunsWorkbench />
    </>
  );
}
