"use client";

import { ArrowDownToLine, CheckCircle2, CircleAlert, Clock3, LoaderCircle, Play, RefreshCw } from "lucide-react";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";

type RunStatus = "PENDING" | "EXTRACTING" | "WAITING_REVIEW" | "ANNOTATING" | "SUCCESS" | "FAILED";

type Run = {
  run_id: string;
  task_type: string;
  status: RunStatus;
  version: number;
  progress: { step: string; percent: number };
  logs: { at: string; level: string; event: string; message: string }[];
  review: { required: boolean; approved_count: number; rejected_count: number; material_ids: string[] };
  collected_items: { id: string; title: string; summary: string; source: string; entities?: string[] }[];
  result?: { provider_model: string; summary: string; entities: string[]; recommended_actions: string[] } | null;
  error?: { code: string; message: string } | null;
};

const statusLabel: Record<RunStatus, string> = {
  PENDING: "排队中",
  EXTRACTING: "正在采集",
  WAITING_REVIEW: "待人工审核",
  ANNOTATING: "AI 处理中",
  SUCCESS: "已完成",
  FAILED: "执行失败"
};

async function readApiBody(response: Response) {
  const body = await response.text();
  try {
    return JSON.parse(body) as Record<string, unknown>;
  } catch {
    return { message: response.ok ? "服务返回了无法识别的数据。" : "任务服务暂时不可用，请稍后重试。" };
  }
}

export function RunsWorkbench() {
  const [taskType, setTaskType] = useState("profiler");
  const [industry, setIndustry] = useState("航空");
  const [run, setRun] = useState<Run | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [highlightCollected, setHighlightCollected] = useState(false);
  const collectedRef = useRef<HTMLElement | null>(null);
  const highlightTimer = useRef<number | null>(null);
  const activeRunId = run?.run_id;
  const activeRunStatus = run?.status;

  const loadRun = useCallback(async (runId: string) => {
    const response = await fetch(`/api/runs/${runId}`, { cache: "no-store" });
    const data = await readApiBody(response);
    if (!response.ok) throw new Error(String(data.message || "读取任务失败"));
    setRun(data as unknown as Run);
  }, []);

  useEffect(() => {
    if (!activeRunId || !activeRunStatus || ["SUCCESS", "FAILED"].includes(activeRunStatus)) return;
    const timer = window.setInterval(() => loadRun(activeRunId).catch((reason: Error) => setError(reason.message)), 1000);
    return () => window.clearInterval(timer);
  }, [activeRunId, activeRunStatus, loadRun]);

  useEffect(() => () => {
    if (highlightTimer.current) window.clearTimeout(highlightTimer.current);
  }, []);

  const revealCollectedInformation = () => {
    setHighlightCollected(true);
    collectedRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    collectedRef.current?.focus({ preventScroll: true });
    if (highlightTimer.current) window.clearTimeout(highlightTimer.current);
    highlightTimer.current = window.setTimeout(() => setHighlightCollected(false), 2400);
  };

  const createRun = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/runs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          task_type: taskType,
          params: { industry },
          idempotency_key: `${Date.now()}-agent-workbench-request`
        })
      });
      const data = await readApiBody(response);
      if (!response.ok) throw new Error(String(data.message || "创建任务失败"));
      await loadRun(String(data.run_id));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "创建任务失败");
    } finally {
      setLoading(false);
    }
  };

  const confirm = async () => {
    if (!run) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/runs/${run.run_id}/confirm`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          reviewer_id: "web-operator",
          approved_material_ids: run.review.material_ids,
          rejected_material_ids: [],
          comment: "通过运营控制台确认",
          expected_version: run.version
        })
      });
      const data = await readApiBody(response);
      if (!response.ok) throw new Error(String(data.message || "确认失败"));
      await loadRun(String(data.run_id));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "确认失败");
    } finally {
      setLoading(false);
    }
  };

  const icon = run?.status === "SUCCESS" ? <CheckCircle2 size={18} /> : run?.status === "FAILED" ? <CircleAlert size={18} /> : <Clock3 size={18} />;

  return (
    <div className="run-workbench">
      <section className="panel run-create-panel">
        <div>
          <p className="eyebrow">Run Control</p>
          <h2>发起运营任务</h2>
          <p className="subtle">创建后自动进入采集队列；本地演示会生成待审核素材，确认后进入 AI 处理状态。</p>
        </div>
        <form className="run-form" onSubmit={createRun}>
          <label className="field">
            <span>任务类型</span>
            <select value={taskType} onChange={(event) => setTaskType(event.target.value)}>
              <option value="profiler">画像分析</option>
              <option value="inquiry">需求探查</option>
              <option value="dispatch">场景分发</option>
              <option value="lifecycle">客户留存</option>
            </select>
          </label>
          <label className="field">
            <span>目标行业</span>
            <input value={industry} onChange={(event) => setIndustry(event.target.value)} required maxLength={50} />
          </label>
          <button className="button" disabled={loading} type="submit"><Play size={16} />{loading ? "处理中…" : "创建任务"}</button>
        </form>
      </section>

      {error && <p className="run-error"><CircleAlert size={16} />{error}</p>}

      {run ? (
        <section className="panel run-detail-panel" aria-live="polite">
          <div className="run-detail-head">
            <div>
              <p className="eyebrow">当前任务</p>
              <h2>{run.run_id.slice(-12)}</h2>
            </div>
            <span className={`run-status status-${run.status.toLowerCase()}`}>{icon}{statusLabel[run.status]}</span>
          </div>
          <div className="run-progress"><span style={{ width: `${run.progress.percent}%` }} /></div>
          <div className="run-meta"><span>{run.progress.percent}%</span><span>{run.progress.step}</span><span>版本 {run.version}</span></div>

          {run.status === "WAITING_REVIEW" && (
            <div className="review-callout">
              <div><strong>等待你的确认</strong><p>系统已生成 {run.review.material_ids.length} 条结构化素材。当前演示只展示素材 ID；接入钉钉业务表后这里会展示摘要、实体和来源链接。</p></div>
              <button className="button" onClick={confirm} disabled={loading}><CheckCircle2 size={16} />确认并进入 AI 处理</button>
            </div>
          )}

          {run.status === "ANNOTATING" && <p className="run-processing"><LoaderCircle size={16} />已收到审核确认，等待模型 Provider 处理。</p>}
          {run.collected_items?.length > 0 && (
            <div className="run-result-nav">
              <div><strong>已收集 {run.collected_items.length} 条新信息</strong><span>可定位到本次任务产生的结构化素材</span></div>
              <button className="button secondary" type="button" onClick={revealCollectedInformation}><ArrowDownToLine size={16} />查看新收集信息</button>
            </div>
          )}
          <div className="run-logs">
            <h3>执行日志</h3>
            {run.logs.map((log) => <div className="run-log" key={`${log.at}-${log.event}`}><time>{new Date(log.at).toLocaleTimeString()}</time><span>{log.message}</span></div>)}
          </div>
          {run.collected_items?.length > 0 && (
            <section
              className={`collected-info${highlightCollected ? " is-highlighted" : ""}`}
              id="newly-collected"
              ref={collectedRef}
              tabIndex={-1}
              aria-label="本次任务新收集的信息"
            >
              <div className="collected-info-head"><div><p className="eyebrow">Newly Collected</p><h3>本次新收集信息</h3></div><span>{run.collected_items.length} 条</span></div>
              {run.collected_items.map((item) => (
                <article className="collected-item" key={item.id}>
                  <div><strong>{item.title}</strong><span>{item.source}</span></div>
                  <p>{item.summary}</p>
                  {item.entities?.length ? <div className="collected-entities">{item.entities.map((entity) => <span key={entity}>{entity}</span>)}</div> : null}
                </article>
              ))}
              {run.result && (
                <div className="provider-result">
                  <div><span>实际处理 Provider</span><strong>{run.result.provider_model}</strong></div>
                  <p>{run.result.summary}</p>
                  <small>建议动作：{run.result.recommended_actions.join(" · ")}</small>
                </div>
              )}
            </section>
          )}
          <button className="button ghost refresh-run" type="button" onClick={() => loadRun(run.run_id).catch((reason: Error) => setError(reason.message))}><RefreshCw size={15} />刷新状态</button>
        </section>
      ) : (
        <section className="run-empty"><Clock3 size={24} /><div><strong>尚未运行任务</strong><p>从左侧表单创建一项运营任务，执行轨迹会在这里持续更新。</p></div></section>
      )}
    </div>
  );
}
