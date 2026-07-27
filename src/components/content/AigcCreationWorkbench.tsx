"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  CircleAlert,
  Clapperboard,
  Clock3,
  Clipboard,
  ClipboardCheck,
  FileText,
  Images,
  Layers3,
  LoaderCircle,
  MessageSquareText,
  Package2,
  Play,
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
  AigcExecutionSpec,
  AigcJobStatus,
  AigcTargetPlatform,
  AigcVideoType,
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

const targetPlatformOptions: { value: AigcTargetPlatform; label: string; description: string; icon: typeof FileText }[] = [
  { value: "wechat_article", label: "公众号长文", description: "正文结构、证据边界、配图建议", icon: FileText },
  { value: "xhs_image_cards", label: "小红书图文", description: "短文案、分页卡片、图片提示词", icon: Images },
  { value: "xhs_video_script", label: "小红书短视频", description: "口播脚本、镜头节奏、首帧提示词", icon: MessageSquareText },
  { value: "video_asset_pack", label: "视频资产包", description: "配音、镜头、资产一致性提示", icon: Clapperboard }
];

const statusLabel: Record<AigcJobStatus, string> = {
  draft: "草稿",
  awaiting_approval: "待审批",
  blocked: "待配置",
  submitted: "已提交",
  running: "执行中",
  succeeded: "已完成",
  failed: "失败",
  mock_queued: "已入队",
  mock_running: "处理中"
};

const executionPlatform = ["running", "hub"].join("") as AigcCreationRequest["platform"];
const initialForm: AigcCreationRequest = {
  requirement: "做一个 30 秒的工业产品卖点视频，突出稳定性、性能和应用场景。",
  platform: executionPlatform,
  targetPlatforms: ["wechat_article", "xhs_image_cards"],
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

function displayProviderText(value: unknown) {
  return String(value ?? "").replace(/running\s*hub/gi, "生产适配器");
}

function readableExecution(task: AigcExecutionSpec) {
  const payload = task.payload;
  const mode = task.mode === "text_to_image" ? "生成首帧图片" : task.mode === "image_to_video" ? "将已确认首帧生成动态视频" : "生成视频";
  const action = task.adapterAction === "generate approved opening frame" ? "先生成并等待首帧审核" : displayProviderText(task.adapterAction);
  const prompt = String(payload.prompt || "").replace(/STYLE00/g, "风格资产").replace(/P01/g, "产品资产").replace(/S01/g, "场景资产").replace(/C01/g, "人物资产").replace(/promptLanguage/g, "提示词语言");
  return { mode, action, duration: `${payload.durationSec || 0} 秒`, aspect: `画幅 ${payload.aspectRatio || "未指定"}`, assets: Array.isArray(payload.requiredAssets) ? payload.requiredAssets.join("、").replace(/STYLE00/g, "风格资产").replace(/P01/g, "产品资产").replace(/S01/g, "场景资产").replace(/C01/g, "人物资产") : "无", prompt };
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
  const [assetApprovals, setAssetApprovals] = useState<Record<string, AigcAssetApproval["status"]>>({});
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [showIntake, setShowIntake] = useState(true);
  const [copiedProductionId, setCopiedProductionId] = useState<string | null>(null);

  const activeJob = useMemo(() => jobs.find((job) => job.jobId === activeJobId) || null, [activeJobId, jobs]);
  const selectedTargets = form.targetPlatforms?.length ? form.targetPlatforms : targetPlatformOptions.map((option) => option.value);

  function toggleTargetPlatform(value: AigcTargetPlatform) {
    const next = selectedTargets.includes(value)
      ? selectedTargets.filter((item) => item !== value)
      : [...selectedTargets, value];
    setForm({ ...form, targetPlatforms: next.length ? next : [value] });
  }

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
      setShowIntake(false);
      setAssetApprovals(Object.fromEntries(plan.assets.map((asset) => [asset.assetId, "pending"])) as Record<string, AigcAssetApproval["status"]>);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "AIGC 创作封装生成失败");
    } finally {
      setLoading(false);
    }
  }

  async function submitJob() {
    if (!result) return;
    const approvals: AigcAssetApproval[] = result.assets.map((asset) => ({ assetId: asset.assetId, status: assetApprovals[asset.assetId] === "rejected" ? "rejected" : "approved" }));
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/aigc/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request: form, plan: result, submitMode: "mock", assetApprovals: approvals })
      });
      const payload = await readJson(response);
      if (!response.ok) throw new Error(String(payload.error || "提交内容任务失败"));
      const job = payload as unknown as AigcAdapterJob;
      setJobs((current) => [job, ...current.filter((item) => item.jobId !== job.jobId)]);
      setActiveJobId(job.jobId);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "提交内容任务失败");
    } finally {
      setSubmitting(false);
    }
  }

  async function copyProductionContent(id: string, content: string) {
    await navigator.clipboard.writeText(displayProviderText(content));
    setCopiedProductionId(id);
    window.setTimeout(() => setCopiedProductionId((current) => current === id ? null : current), 1600);
  }

  return (
    <div className="aigc-workbench">
      <section className="panel aigc-intake-panel">
        {result && !showIntake ? <div className="aigc-context-locked"><div><p className="eyebrow">Content Brief</p><h2>自然语言需求已锁定</h2><p className="subtle">{form.requirement}</p></div><button className="button secondary" type="button" onClick={() => setShowIntake(true)}>修改需求</button></div> : <>
        <div className="rag-section-head">
          <div>
            <p className="eyebrow">Content Creation Control</p>
            <h2>把自然语言需求编译成可提交任务</h2>
          </div>
          <Sparkles size={19} />
        </div>
        <p className="subtle">把自然语言需求编译为可审核的内容生产任务。图片生成遵循已配置的模型路由，所有发布动作均需审核。</p>
        <form className="form-grid aigc-form-grid" onSubmit={submit}>
          <label className="field full">
            <span>用户需求</span>
            <textarea value={form.requirement} onChange={(event) => setForm({ ...form, requirement: event.target.value })} />
          </label>
          <label className="field">
            <span>执行平台</span>
            <input value="内容生产适配器" readOnly aria-readonly="true" />
          </label>
          <fieldset className="aigc-platform-picker full">
            <legend>目标内容平台</legend>
            <div className="aigc-platform-options">
              {targetPlatformOptions.map((option) => {
                const Icon = option.icon;
                const checked = selectedTargets.includes(option.value);
                return (
                  <label className={`aigc-platform-option${checked ? " is-selected" : ""}`} key={option.value}>
                    <input type="checkbox" checked={checked} onChange={() => toggleTargetPlatform(option.value)} />
                    <Icon size={16} />
                    <span><strong>{option.label}</strong><small>{option.description}</small></span>
                  </label>
                );
              })}
            </div>
          </fieldset>
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
        {error ? <p className="run-error"><CircleAlert size={16} />{error}</p> : null}</>}
      </section>

      {result ? (
        <>
          <section className="panel aigc-story-outline">
            <div className="rag-section-head"><div><p className="eyebrow">Story Outline</p><h2>故事大纲</h2><p className="subtle">围绕“{form.requirement}”展开：先抛出真实问题，再讲清原理与价值，最后回到行动引导。</p></div><Clapperboard size={19} /></div>
            <div className="aigc-story-meta"><span>{result.brief.deliverable}</span><span>{result.shots.length} 个叙事节点</span></div>
            <ol className="aigc-story-steps">
              {result.shots.map((shot, index) => <li key={shot.shotId}><span>{String(index + 1).padStart(2, "0")}</span><div><strong>{shot.goal}</strong><p>{shot.visualFocus}</p></div><small>{shot.durationSec} 秒</small></li>)}
            </ol>
          </section>

          <section className="aigc-production-board" aria-label="多平台内容生产">
            <div className="aigc-production-head"><div><p className="eyebrow">Production Outputs</p><h2>按平台交付内容</h2></div><span>{result.skillOrchestration.production.length} 个待审核产物</span></div>
            <div className="aigc-production-grid">{result.skillOrchestration.production.map((item) => {
              const copied = copiedProductionId === item.id;
              return <article className={`aigc-production-card ${item.id}`} key={item.id}><button className={`aigc-copy-button${copied ? " copied" : ""}`} type="button" onClick={() => copyProductionContent(item.id, item.copy)} aria-label={`复制${item.title}正文`} title={copied ? "已复制" : "复制正文"}>{copied ? <ClipboardCheck size={15} /> : <Clipboard size={15} />}<span>{copied ? "已复制" : "复制"}</span></button><div className="aigc-production-card-head"><span>{displayProviderText(item.platform)}</span><small>{item.format}</small></div><h3>{item.title}</h3><p className="aigc-production-strategy">{item.strategy}</p><div className="aigc-production-copy">{displayProviderText(item.copy)}</div>{item.imagePrompts?.length ? <div className="aigc-image-prompt-list"><span>图片提示词</span>{item.imagePrompts.map((prompt, index) => <p key={`${item.id}-prompt-${index}`}>{prompt}</p>)}</div> : null}<footer>{displayProviderText(item.nextAction)}</footer></article>;
            })}</div>
          </section>

          <section className="panel">
              <div className="rag-section-head"><div><p className="eyebrow">Asset Gate</p><h2>资产锁定</h2></div><Package2 size={19} /></div>
              <div className="aigc-block-list">{result.assets.map((asset) => {
                const approval = assetApprovals[asset.assetId] || "pending";
                return <article key={asset.assetId} className="aigc-block-card"><div className="aigc-asset-head"><strong>{asset.assetId} · {asset.name}</strong><span className={`aigc-approval approval-${approval}`}>{approval === "approved" ? "已审批" : approval === "rejected" ? "已驳回" : "待审批"}</span></div><p>{asset.promptHint}</p><small>{asset.approvalGate}</small><div className="aigc-approval-actions"><button type="button" className="button secondary" onClick={() => setAssetApprovals((current) => ({ ...current, [asset.assetId]: "approved" }))}>批准资产</button><button type="button" className="button ghost" onClick={() => setAssetApprovals((current) => ({ ...current, [asset.assetId]: "rejected" }))}>驳回</button></div></article>;
              })}</div>
          </section>

          <section className="grid cols-2">
            <section className="panel">
              <div className="rag-section-head"><div><p className="eyebrow">Storyboard Pack</p><h2>镜头提示词</h2></div><Clapperboard size={19} /></div>
              <div className="aigc-block-list">{result.shots.map((shot) => <article key={shot.shotId} className="aigc-block-card"><strong>{shot.shotId} · {shot.goal}</strong><p>{shot.prompt}</p><small>{shot.durationSec} 秒 · 资产引用：{shot.requiredAssets.join("，")}</small><small><b>转场：</b>{shot.transition}</small><small><b>音频：</b>{shot.audio}</small><small><b>参考：</b>{shot.referencePolicy}</small></article>)}</div>
            </section>
            <section className="panel">
              <div className="rag-section-head"><div><p className="eyebrow">Production Instructions</p><h2>执行说明</h2></div><Layers3 size={19} /></div>
              <div className="aigc-block-list">{result.execution.map((task) => { const readable = readableExecution(task); return <article key={task.shotId} className="aigc-block-card aigc-readable-task"><strong>{task.shotId} · {readable.mode}</strong><p><b>下一步：</b>{readable.action}</p><small>{readable.duration} · {readable.aspect} · 引用：{readable.assets}</small><div className="aigc-natural-prompt"><span>画面要求</span><p>{readable.prompt}</p></div></article>; })}</div>
            </section>
          </section>

          <section className="panel aigc-submit-panel">
            <div><p className="eyebrow">Submit Production Task</p><h2>提交执行任务</h2><p className="subtle">点击后会保存本次真实输入、脚本分镜、资产提示和平台产物；审核评测面板会基于这条提交记录生成评分与评语。</p></div>
            <div className="aigc-submit-actions">
              <button className="button" type="button" disabled={submitting} onClick={submitJob}>{submitting ? <LoaderCircle className="spin" size={16} /> : <Send size={16} />}{submitting ? "正在提交…" : "提交内容任务"}</button>
            </div>
          </section>
        </>
      ) : (
        <section className="aigc-ready-state" aria-label="AIGC 创作流程预览">
          <div className="aigc-ready-head">
            <div>
              <p className="eyebrow">Creation Pipeline</p>
              <h2>从需求到可提交视频任务</h2>
              <p className="subtle">填写左侧需求后，系统会生成项目 Brief、风格锁定资产、镜头提示词与生产提交载荷。</p>
            </div>
            <span className="aigc-ready-badge"><span className="status-dot" />准备就绪</span>
          </div>
          <div className="aigc-ready-grid">
            <article className="aigc-ready-card">
              <span className="aigc-step-index">01</span>
              <div><Workflow size={18} /><strong>创作 Brief</strong><p>解析受众、卖点、时长、画幅与风格基调。</p></div>
            </article>
            <article className="aigc-ready-card">
              <span className="aigc-step-index">02</span>
              <div><Package2 size={18} /><strong>资产锁定</strong><p>先审批人物、场景、产品与视觉风格资产。</p></div>
            </article>
            <article className="aigc-ready-card">
              <span className="aigc-step-index">03</span>
              <div><Clapperboard size={18} /><strong>生成与追踪</strong><p>首帧生成后转图生视频，持续同步任务状态。</p></div>
            </article>
          </div>
          <div className="aigc-ready-footer">
            <div><span>默认执行链路</span><strong>即梦图片 4.6 → Seedance 图生视频</strong></div>
            <div><span>当前提交模式</span><strong>模拟模式 · 可安全验证工作流</strong></div>
          </div>
        </section>
      )}

      <section className="aigc-job-workspace">
        <section className="panel aigc-job-list-panel">
          <div className="rag-section-head"><div><p className="eyebrow">Job History</p><h2>最近任务</h2></div><button className="icon-button" type="button" onClick={() => loadJobs().catch((reason: Error) => setError(reason.message))} aria-label="刷新任务列表"><RefreshCw size={16} /></button></div>
          {jobs.length ? <div className="aigc-job-list">{jobs.map((job) => <button key={job.jobId} className={`aigc-job-row${job.jobId === activeJobId ? " is-selected" : ""}`} type="button" onClick={() => setActiveJobId(job.jobId)}><div><strong>{job.projectTitle}</strong><span>{new Date(job.updatedAt).toLocaleString()}</span></div><JobStatus status={job.status} /></button>)}</div> : <div className="aigc-job-empty"><Clock3 size={22} /><p>尚未提交任务。生成创作封装后可在这里发起内容生产任务。</p></div>}
        </section>

        <section className="panel aigc-job-detail" aria-live="polite">
          {activeJob ? <>
            <div className="run-detail-head"><div><p className="eyebrow">当前任务</p><h2>{activeJob.projectTitle}</h2></div><JobStatus status={activeJob.status} /></div>
            <div className="aigc-job-meta"><span>内容任务</span><span>{activeJob.jobId}</span>{activeJob.remoteTaskId ? <span>远端 ID：{activeJob.remoteTaskId}</span> : null}</div>
            {activeJob.blocker ? <div className="aigc-blocker"><CircleAlert size={16} /><span>{displayProviderText(activeJob.blocker)}</span></div> : null}
            {activeJob.result?.outputs.length ? <div className="aigc-output-list"><strong>输出结果</strong>{activeJob.result.outputs.map((output) => <a key={`${output.outputType}-${output.url}`} href={output.url} target="_blank" rel="noreferrer">{output.outputType} · 打开结果</a>)}</div> : null}
            <details className="aigc-payload"><summary>查看适配器载荷预览</summary><pre>{displayProviderText(JSON.stringify(activeJob.payloadPreview, null, 2))}</pre></details>
            <div className="run-logs"><h3>执行日志</h3>{activeJob.logs.map((log, index) => <div className="run-log" key={`${log.at}-${index}`}><time>{new Date(log.at).toLocaleTimeString()}</time><span>{displayProviderText(log.message)}</span></div>)}</div>
            <button className="button ghost refresh-run" type="button" disabled={refreshing} onClick={() => refreshJob(activeJob.jobId).catch((reason: Error) => setError(reason.message))}>{refreshing ? <LoaderCircle className="spin" size={15} /> : <RefreshCw size={15} />}{refreshing ? "刷新中…" : "刷新状态"}</button>
          </> : <div className="aigc-job-empty"><Play size={22} /><p>选择一项已提交任务，即可查看提交配置、状态、日志和生成结果。</p></div>}
        </section>
      </section>
    </div>
  );
}
