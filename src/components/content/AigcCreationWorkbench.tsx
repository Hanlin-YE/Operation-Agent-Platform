"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  CircleAlert,
  Clapperboard,
  Clock3,
  Layers3,
  LoaderCircle,
  Package2,
  Play,
  PlugZap,
  RefreshCw,
  Send,
  Sparkles,
  Workflow
} from "lucide-react";
import type {
  AigcAdapterJob,
  AigcAssetApproval,
  AigcCreationRequest,
  AigcCreationResponse,
  AigcJobStatus,
  AigcVideoType,
  AigcSubmitMode,
  PromptLanguage
} from "@/server/aigc/types";

const videoTypeOptions: { value: AigcVideoType; label: string }[] = [
  { value: "product_ad", label: "卖点广告短片" },
  { value: "product_showcase", label: "产品展示视频" },
  { value: "brand_intro", label: "品牌介绍视频" },
  { value: "xiaohongshu", label: "小红书口播/种草" }
];

const languageOptions: { value: PromptLanguage; label: string }[] = [
  { value: "zh", label: "中文提示词" },
  { value: "en", label: "英文提示词" },
  { value: "bilingual", label: "双语提示词" }
];

const statusLabel: Record<AigcJobStatus, string> = {
  draft: "草稿",
  awaiting_approval: "待审批",
  blocked: "待配置",
  submitted: "已提交",
  running: "执行中",
  succeeded: "已完成",
  failed: "失败",
  mock_queued: "模拟排队",
  mock_running: "模拟执行"
};

const initialForm: AigcCreationRequest = {
  requirement: "做一个 30 秒的工业产品卖点视频，突出稳定性、性能和应用场景。",
  platform: "runninghub",
  videoType: "product_ad",
  durationSec: 30,
  aspectRatio: "16:9",
  styleTone: "工业质感、克制、偏 cinematic",
  promptLanguage: "zh"
};

async function readJson(response: Response) {
  const body = await response.text();
  try {
    return JSON.parse(body) as Record<string, unknown>;
  } catch {
    return { error: "服务返回了无法识别的数据。" };
  }
}

function isTerminal(status: AigcJobStatus) {
  return ["blocked", "succeeded", "failed"].includes(status);
}

function JobStatus({ status }: { status: AigcJobStatus }) {
  const icon = status === "succeeded" ? <CheckCircle2 size={15} /> : status === "failed" || status === "blocked" ? <CircleAlert size={15} /> : <Clock3 size={15} />;
  return <span className={`run-status aigc-job-status status-${status}`}>{icon}{statusLabel[status]}</span>;
}

export function AigcCreationWorkbench() {
  const [form, setForm] = useState<AigcCreationRequest>(initialForm);
  const [result, setResult] = useState<AigcCreationResponse | null>(null);
  const [jobs, setJobs] = useState<AigcAdapterJob[]>([]);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [submitMode, setSubmitMode] = useState<AigcSubmitMode>("mock");
  const [assetApprovals, setAssetApprovals] = useState<Record<string, AigcAssetApproval["status"]>>({});
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const activeJob = useMemo(() => jobs.find((job) => job.jobId === activeJobId) || null, [activeJobId, jobs]);

  const loadJobs = useCallback(async () => {
    const response = await fetch("/api/aigc/jobs", { cache: "no-store" });
    const payload = await readJson(response);
    if (!response.ok || !Array.isArray(payload)) throw new Error(String(payload.error || "读取 AIGC 任务失败"));
    setJobs(payload as unknown as AigcAdapterJob[]);
  }, []);

  const refreshJob = useCallback(async (jobId: string, quiet = false) => {
    if (!quiet) setRefreshing(true);
    try {
      const response = await fetch(`/api/aigc/jobs/${jobId}`, { cache: "no-store" });
      const payload = await readJson(response);
      if (!response.ok) throw new Error(String(payload.error || "刷新任务状态失败"));
      const next = payload as unknown as AigcAdapterJob;
      setJobs((current) => [next, ...current.filter((job) => job.jobId !== next.jobId)]);
      setActiveJobId(next.jobId);
    } finally {
      if (!quiet) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadJobs().catch((reason: Error) => setError(reason.message));
  }, [loadJobs]);

  useEffect(() => {
    if (!activeJob || isTerminal(activeJob.status)) return;
    const timer = window.setInterval(() => refreshJob(activeJob.jobId, true).catch((reason: Error) => setError(reason.message)), 3000);
    return () => window.clearInterval(timer);
  }, [activeJob, refreshJob]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/aigc/creation-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      const payload = await readJson(response);
      if (!response.ok) throw new Error(String(payload.error || "AIGC 创作封装生成失败"));
      const plan = payload as unknown as AigcCreationResponse;
      setResult(plan);
      setAssetApprovals(Object.fromEntries(plan.assets.map((asset) => [asset.assetId, "pending"])) as Record<string, AigcAssetApproval["status"]>);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "AIGC 创作封装生成失败");
    } finally {
      setLoading(false);
    }
  }

  async function submitJob() {
    if (!result) return;
    const approvals: AigcAssetApproval[] = result.assets.map((asset) => ({ assetId: asset.assetId, status: assetApprovals[asset.assetId] || "pending" }));
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/aigc/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request: form, plan: result, submitMode, assetApprovals: approvals })
      });
      const payload = await readJson(response);
      if (!response.ok) throw new Error(String(payload.error || "提交 RunningHub 任务失败"));
      const job = payload as unknown as AigcAdapterJob;
      setJobs((current) => [job, ...current.filter((item) => item.jobId !== job.jobId)]);
      setActiveJobId(job.jobId);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "提交 RunningHub 任务失败");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="aigc-workbench">
      <section className="panel aigc-intake-panel">
        <div className="rag-section-head">
          <div>
            <p className="eyebrow">RunningHub Creation Control</p>
            <h2>把自然语言需求编译成可提交任务</h2>
          </div>
          <Sparkles size={19} />
        </div>
        <p className="subtle">固定由 RunningHub 执行：即梦图片 4.6 先生成风格锁定首帧，Seedance 再完成图生视频。生成前可审核，提交后可追踪。</p>
        <form className="form-grid aigc-form-grid" onSubmit={submit}>
          <label className="field full">
            <span>用户需求</span>
            <textarea value={form.requirement} onChange={(event) => setForm({ ...form, requirement: event.target.value })} />
          </label>
          <label className="field">
            <span>执行平台</span>
            <input value="RunningHub" readOnly aria-readonly="true" />
          </label>
          <label className="field">
            <span>视频类型</span>
            <select value={form.videoType} onChange={(event) => setForm({ ...form, videoType: event.target.value as AigcVideoType })}>
              {videoTypeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label className="field">
            <span>时长（秒）</span>
            <input type="number" min={3} max={180} value={form.durationSec} onChange={(event) => setForm({ ...form, durationSec: Number(event.target.value) || 3 })} />
          </label>
          <label className="field">
            <span>画幅</span>
            <select value={form.aspectRatio} onChange={(event) => setForm({ ...form, aspectRatio: event.target.value as AigcCreationRequest["aspectRatio"] })}>
              <option value="16:9">16:9</option><option value="9:16">9:16</option><option value="1:1">1:1</option>
            </select>
          </label>
          <label className="field">
            <span>风格基调</span>
            <input value={form.styleTone} onChange={(event) => setForm({ ...form, styleTone: event.target.value })} />
          </label>
          <label className="field">
            <span>提示词语言</span>
            <select value={form.promptLanguage} onChange={(event) => setForm({ ...form, promptLanguage: event.target.value as PromptLanguage })}>
              {languageOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <div className="actions">
            <button className="button" disabled={loading} type="submit">
              {loading ? <LoaderCircle className="spin" size={16} /> : <Layers3 size={16} />}
              {loading ? "正在编译执行层…" : "生成 AIGC 创作封装"}
            </button>
          </div>
        </form>
        {error ? <p className="run-error"><CircleAlert size={16} />{error}</p> : null}
      </section>

      {result ? (
        <>
          <section className="grid cols-3 aigc-summary-grid">
            <article className="panel stat"><strong>{result.brief.deliverable}</strong><p className="subtle">交付规格</p></article>
            <article className="panel stat"><strong>{result.assets.length}</strong><p className="subtle">待审批资产</p></article>
            <article className="panel stat"><strong>{result.execution.length}</strong><p className="subtle">待提交执行节点</p></article>
          </section>

          <section className="panel">
            <div className="rag-section-head"><div><p className="eyebrow">Layer Stack</p><h2>{result.projectTitle}</h2></div><Workflow size={19} /></div>
            <p className="subtle">{result.summary}</p>
            <div className="aigc-layer-list">{result.layers.map((layer) => <article key={layer.id} className="aigc-layer-card"><strong>{layer.name}</strong><p>{layer.purpose}</p><small>输出：{layer.output}</small></article>)}</div>
          </section>

          <section className="grid cols-2">
            <section className="panel">
              <div className="rag-section-head"><div><p className="eyebrow">Asset Gate</p><h2>资产锁定</h2></div><Package2 size={19} /></div>
              <div className="aigc-block-list">{result.assets.map((asset) => {
                const approval = assetApprovals[asset.assetId] || "pending";
                return <article key={asset.assetId} className="aigc-block-card"><div className="aigc-asset-head"><strong>{asset.assetId} · {asset.name}</strong><span className={`aigc-approval approval-${approval}`}>{approval === "approved" ? "已审批" : approval === "rejected" ? "已驳回" : "待审批"}</span></div><p>{asset.promptHint}</p><small>{asset.approvalGate}</small><div className="aigc-approval-actions"><button type="button" className="button secondary" onClick={() => setAssetApprovals((current) => ({ ...current, [asset.assetId]: "approved" }))}>批准资产</button><button type="button" className="button ghost" onClick={() => setAssetApprovals((current) => ({ ...current, [asset.assetId]: "rejected" }))}>驳回</button></div></article>;
              })}</div>
            </section>

            <section className="panel">
              <div className="rag-section-head"><div><p className="eyebrow">Adapter Strategy</p><h2>RunningHub 适配</h2></div><PlugZap size={19} /></div>
              <div className="aigc-adapter-meta">
                <div><span>平台</span><strong>RunningHub</strong></div><div><span>首帧模型</span><strong>{result.adapter.imageModel}</strong></div>
                <div><span>视频模型</span><strong>{result.adapter.videoModel}</strong></div><div><span>任务策略</span><strong>首帧 → 图生视频</strong></div>
              </div>
              <div className="aigc-tag-row">{result.adapter.capabilityRoute.map((item) => <span className="badge" key={item}>{item}</span>)}</div>
              {result.adapter.modelNote ? <p className="subtle">{result.adapter.modelNote}</p> : null}
              {result.adapter.standardModelUrl ? <a className="button secondary" href={result.adapter.standardModelUrl} target="_blank" rel="noreferrer">打开 RunningHub 标准模型页</a> : null}
            </section>
          </section>

          <section className="grid cols-2">
            <section className="panel">
              <div className="rag-section-head"><div><p className="eyebrow">Storyboard Pack</p><h2>镜头提示词</h2></div><Clapperboard size={19} /></div>
              <div className="aigc-block-list">{result.shots.map((shot) => <article key={shot.shotId} className="aigc-block-card"><strong>{shot.shotId} · {shot.goal}</strong><p>{shot.prompt}</p><small>{shot.durationSec} 秒 · 资产引用：{shot.requiredAssets.join("，")}</small></article>)}</div>
            </section>
            <section className="panel">
              <div className="rag-section-head"><div><p className="eyebrow">Execution Spec</p><h2>可提交任务</h2></div><Layers3 size={19} /></div>
              <div className="aigc-block-list">{result.execution.map((task) => <article key={task.shotId} className="aigc-block-card"><strong>{task.shotId} · {task.mode}</strong><p>{task.adapterAction}</p><pre>{JSON.stringify(task.payload, null, 2)}</pre></article>)}</div>
            </section>
          </section>

          <section className="panel aigc-submit-panel">
            <div><p className="eyebrow">Submit to RunningHub</p><h2>提交执行任务</h2><p className="subtle">所有资产审批通过后才可提交。模拟模式用于走通任务状态和界面；真实模式仅在服务端已配置 RunningHub 密钥与提交地址时才会发送请求。</p></div>
            <div className="aigc-submit-actions">
              <div className="aigc-mode-toggle" role="group" aria-label="提交模式">
                <button type="button" className={submitMode === "mock" ? "is-active" : ""} onClick={() => setSubmitMode("mock")}>模拟模式</button>
                <button type="button" className={submitMode === "live" ? "is-active" : ""} onClick={() => setSubmitMode("live")}>真实模式</button>
              </div>
              <button className="button" type="button" disabled={submitting || result.assets.some((asset) => assetApprovals[asset.assetId] !== "approved")} onClick={submitJob}>{submitting ? <LoaderCircle className="spin" size={16} /> : <Send size={16} />}{submitting ? "正在提交…" : "提交 RunningHub 任务"}</button>
            </div>
          </section>
        </>
      ) : null}

      <section className="aigc-job-workspace">
        <section className="panel aigc-job-list-panel">
          <div className="rag-section-head"><div><p className="eyebrow">Job History</p><h2>最近任务</h2></div><button className="icon-button" type="button" onClick={() => loadJobs().catch((reason: Error) => setError(reason.message))} aria-label="刷新任务列表"><RefreshCw size={16} /></button></div>
          {jobs.length ? <div className="aigc-job-list">{jobs.map((job) => <button key={job.jobId} className={`aigc-job-row${job.jobId === activeJobId ? " is-selected" : ""}`} type="button" onClick={() => setActiveJobId(job.jobId)}><div><strong>{job.projectTitle}</strong><span>{new Date(job.updatedAt).toLocaleString()}</span></div><JobStatus status={job.status} /></button>)}</div> : <div className="aigc-job-empty"><Clock3 size={22} /><p>尚未提交任务。生成创作封装后可在这里发起 RunningHub 任务。</p></div>}
        </section>

        <section className="panel aigc-job-detail" aria-live="polite">
          {activeJob ? <>
            <div className="run-detail-head"><div><p className="eyebrow">当前任务</p><h2>{activeJob.projectTitle}</h2></div><JobStatus status={activeJob.status} /></div>
            <div className="aigc-job-meta"><span>{activeJob.submitMode === "mock" ? "模拟执行" : "真实执行"}</span><span>{activeJob.jobId}</span>{activeJob.remoteTaskId ? <span>远端 ID：{activeJob.remoteTaskId}</span> : null}</div>
            {activeJob.blocker ? <div className="aigc-blocker"><CircleAlert size={16} /><span>{activeJob.blocker}</span></div> : null}
            {activeJob.result?.outputs.length ? <div className="aigc-output-list"><strong>输出结果</strong>{activeJob.result.outputs.map((output) => <a key={`${output.outputType}-${output.url}`} href={output.url} target="_blank" rel="noreferrer">{output.outputType} · 打开结果</a>)}</div> : null}
            <details className="aigc-payload"><summary>查看适配器载荷预览</summary><pre>{JSON.stringify(activeJob.payloadPreview, null, 2)}</pre></details>
            <div className="run-logs"><h3>执行日志</h3>{activeJob.logs.map((log, index) => <div className="run-log" key={`${log.at}-${index}`}><time>{new Date(log.at).toLocaleTimeString()}</time><span>{log.message}</span></div>)}</div>
            <button className="button ghost refresh-run" type="button" disabled={refreshing} onClick={() => refreshJob(activeJob.jobId).catch((reason: Error) => setError(reason.message))}>{refreshing ? <LoaderCircle className="spin" size={15} /> : <RefreshCw size={15} />}{refreshing ? "刷新中…" : "刷新状态"}</button>
          </> : <div className="aigc-job-empty"><Play size={22} /><p>选择一项已提交任务，即可查看提交配置、状态、日志和生成结果。</p></div>}
        </section>
      </section>
    </div>
  );
}
