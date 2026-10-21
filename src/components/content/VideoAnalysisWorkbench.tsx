"use client";

import { FormEvent, useEffect, useState } from "react";
import { BarChart3, CheckCircle2, CircleAlert, Clapperboard, FileVideo, LoaderCircle, Scissors, Upload, X } from "lucide-react";
import { buildVideoReferenceScore, formatVideoAnalysisClientError, getVideoAnalysisJobPath, validateVideoSourceUrl, type VideoAnalysisResult } from "@/server/videoAnalysis/service";

type StrategySample = { title: string; content: string; sourceUrl?: string };
type AgentHealth = { ok: boolean; message: string; healthUrl?: string };

export function VideoAnalysisWorkbench({ initialJobId, onUseAsStrategy }: { initialJobId?: string; onUseAsStrategy?: (sample: StrategySample) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [sourceUrl, setSourceUrl] = useState("");
  const [result, setResult] = useState<VideoAnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [agentHealth, setAgentHealth] = useState<AgentHealth | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/video-analysis/health", { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({ ok: false, message: "视频分析服务健康检查返回异常。" }));
        return { ok: response.ok && Boolean(payload.ok), message: String(payload.message || "视频分析服务健康检查返回异常。"), healthUrl: typeof payload.healthUrl === "string" ? payload.healthUrl : undefined };
      })
      .then((payload) => { if (active) setAgentHealth(payload); })
      .catch(() => { if (active) setAgentHealth({ ok: false, message: "视频分析服务未连接。请启动本地 Agent 并检查 VIDEO_ANALYZER_BASE_URL。" }); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!initialJobId) return;
    let active = true;
    setLoading(true); setError("");
    fetch(getVideoAnalysisJobPath(initialJobId), { cache: "no-store" })
      .then(async (response) => { const payload = await response.json(); if (!response.ok) throw new Error(payload.error || "无法恢复视频分析结果。"); return payload; })
      .then((payload) => { if (active) setResult(payload as VideoAnalysisResult); })
      .catch((reason) => { if (active) setError(formatVideoAnalysisClientError(reason)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [initialJobId]);

  useEffect(() => {
    if (!result || !["queued", "processing"].includes(result.status)) return;
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(getVideoAnalysisJobPath(result.jobId), { cache: "no-store" });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "无法读取视频分析任务。");
        setResult(payload as VideoAnalysisResult);
      } catch (reason) {
        setError(formatVideoAnalysisClientError(reason));
      }
    }, 2500);
    return () => window.clearTimeout(timer);
  }, [result]);

  async function analyze(event: FormEvent) {
    event.preventDefault();
    if (!file && !sourceUrl.trim()) return setError("请先选择一个视频文件，或输入一个公开视频链接。");
    let normalizedSourceUrl = "";
    if (!file) {
      try {
        normalizedSourceUrl = validateVideoSourceUrl(sourceUrl);
      } catch (reason) {
        return setError(reason instanceof Error ? reason.message : "视频链接格式不正确。");
      }
    }
    setLoading(true); setError(""); setResult(null);
    const form = new FormData();
    if (file) form.set("video", file); else form.set("sourceUrl", normalizedSourceUrl);
    try {
      const response = await fetch("/api/video-analysis/jobs", { method: "POST", body: form });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "视频分析失败。");
      setResult(payload as VideoAnalysisResult);
    } catch (reason) { setError(formatVideoAnalysisClientError(reason)); }
    finally { setLoading(false); }
  }

  const timeline = ["等待队列", "准备本地模型", "解析/下载视频", "转写", "场景切分", "拉片结构分析", "等待人工审核"];
  const currentStep = result?.step || "等待队列";
  const currentIndex = timeline.indexOf(currentStep);
  const review = result ? buildVideoReferenceScore(result) : null;

  return <section className="video-analysis-workbench">
    <form className="panel video-analysis-intake" onSubmit={analyze} noValidate>
      <div className="strategy-heading"><div><p className="eyebrow">Video reference analysis</p><h2>视频拆解与剧本提取</h2></div><Clapperboard size={20} /></div>
      <p className="subtle">输入已获授权的公开视频链接，或上传本地视频。系统提取台词、场景时间轴、故事结构与可复用的爆点规律；分析完成后必须人工确认。</p>
      {agentHealth ? <div className={`video-agent-status ${agentHealth.ok ? "ok" : "offline"}`}>{agentHealth.ok ? <CheckCircle2 size={15}/> : <CircleAlert size={15}/>}<span>{agentHealth.message}</span>{agentHealth.healthUrl ? <code>{agentHealth.healthUrl}</code> : null}</div> : null}
      <label className="field video-analysis-url"><span>公开视频 URL</span><input type="text" inputMode="url" value={sourceUrl} disabled={!!file} onChange={(event) => { setSourceUrl(event.target.value); setError(""); }} placeholder="https://b23.tv/xxxx 或 https://example.com/reference.mp4" /><small>支持哔哩哔哩公开短链／视频页及可直接访问的 MP4、MOV、WebM 链接；登录保护、地区限制或付费内容请使用授权导入或本地上传。</small></label>
      <div className="video-analysis-upload-row">
        <label className="video-analysis-upload"><Upload size={18}/><span>{file ? file.name : "选择视频文件"}<small>{file ? `${(file.size / 1024 / 1024).toFixed(1)} MB` : "MP4、MOV、WebM · 最大 300MB"}</small></span><input key={file ? "selected-video" : "empty-video"} type="file" accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm" onChange={(event) => { setFile(event.target.files?.[0] || null); setSourceUrl(""); setError(""); }} /></label>
        {file ? <button className="icon-button" type="button" onClick={() => setFile(null)} aria-label="移除已选择视频" title="移除已选择视频"><X size={15}/></button> : null}
      </div>
      <button className="button" disabled={loading || result?.status === "queued" || result?.status === "processing"}>{loading ? <LoaderCircle className="spin" size={16}/> : <FileVideo size={16}/>} {loading ? "正在创建任务…" : result?.status === "queued" || result?.status === "processing" ? "任务处理中…" : "开始拆解"}</button>
      {result && <p className="subtle">任务会在关闭页面后继续执行。<a href="/tasks">前往任务中心查看记录或重试</a></p>}
      {error && <p className="run-error"><CircleAlert size={16}/>{error}</p>}
    </form>
    {result && <section className="panel video-analysis-result" id="video-analysis-result">
      <div className="strategy-heading"><div><p className="eyebrow">Evidence-backed script</p><h2>{result.script?.title || result.message || "视频证据已登记"}</h2></div><span className={`strategy-chip ${result.status === "needs_review" ? "approved" : "neutral"}`}>{result.status === "needs_review" ? "等待人工审核" : result.status === "failed" ? "处理失败" : result.status === "model_not_configured" ? "等待模型配置" : "处理中"}</span></div>
      <ol className="video-job-timeline">{timeline.map((step, index) => <li key={step} className={result.status === "failed" && step === currentStep ? "failed" : index < currentIndex || result.status === "needs_review" ? "done" : step === currentStep ? "active" : ""}><span>{index < currentIndex || result.status === "needs_review" ? "✓" : index + 1}</span><div><b>{step}</b>{step === currentStep ? <small>{result.percent ?? 0}% · {result.message}</small> : null}</div></li>)}</ol>
      {result.status === "failed" ? <div className="strategy-notice danger"><CircleAlert size={17}/><div><strong>{typeof result.error === "object" ? result.error.message : result.error || "视频拉片失败"}</strong><p>上传的视频已保存在本地。请根据错误修正配置后，在任务中心重试。</p></div></div> : null}
      {result.status === "model_not_configured" ? <div className="strategy-notice"><CircleAlert size={17}/><div><strong>模型尚未配置</strong><p>已完成本地证据提取；配置统一模型后才能把证据整理为剧本，不会生成模拟内容。</p></div></div> : null}
      {result.script ? <><p className="video-script-summary">{result.script.summary}</p><div className="video-breakdown-grid"><article><span>故事大纲</span><p>{result.script.storyOutline}</p></article><article><span>开场钩子</span><p>{result.script.viralBreakdown.hook}</p></article><article><span>可复用规律</span><ul>{result.script.viralBreakdown.reusablePatterns.map((item) => <li key={item}>{item}</li>)}</ul></article><article><span>B 端改写建议</span><p>{result.script.viralBreakdown.b2bAdaptation}</p></article></div><div className="video-beat-table"><div className="video-beat-head"><span>时间</span><span>画面与台词</span><span>段落目的</span></div>{result.script.beats.map((beat, index) => <div className="video-beat-row" key={`${beat.startSec}-${index}`}><time>{beat.startSec.toFixed(1)}–{beat.endSec.toFixed(1)} 秒</time><p><b>{beat.visual}</b>{beat.narration}</p><span>{beat.purpose}</span></div>)}</div>{review ? <section className="video-reference-review" aria-label="内容策略视频评分"><div className="aigc-review-scorebar"><div><p className="eyebrow">Strategy-only evaluation</p><h2>{review.verdict}</h2><p className="subtle">评分模板参考审核评测的连续性、创新性、分镜专业性与内容适配度；这里只评估当前视频拆解结果，不写入审核评测面板。</p></div><strong className={`aigc-review-score ${review.level}`}>{review.score}<span>分</span></strong></div><div className="aigc-review-dimensions">{review.dimensions.map((item) => <article key={item.id} className="aigc-review-dimension"><div className="aigc-review-dimension-head"><div><strong>{item.label}</strong><span>{item.verdict}</span></div><span className={`badge grade-${item.score >= 85 ? "A" : item.score >= 72 ? "B" : item.score >= 60 ? "C" : "D"}`}>{item.score} 分</span></div><blockquote>{item.evidence}</blockquote><p>{item.feedback}</p><small>{item.revisionAction}</small></article>)}</div><div className="video-segment-scores"><div className="rag-section-head"><div><p className="eyebrow">Segment scoring</p><h2>视频片段拆分评分</h2></div><Scissors size={18}/></div>{review.beatScores.map((item) => <article key={`${item.label}-${item.timeRange}`}><div><BarChart3 size={15}/><strong>{item.label}</strong><time>{item.timeRange}</time></div><span className={`badge grade-${item.score >= 85 ? "A" : item.score >= 72 ? "B" : item.score >= 60 ? "C" : "D"}`}>{item.score} 分 · {item.verdict}</span><p>{item.evidence}</p></article>)}</div></section> : null}{onUseAsStrategy ? <button className="button" type="button" onClick={() => onUseAsStrategy({ title: result.script!.title, sourceUrl: result.source.sourceUrl, content: [result.script!.summary, `故事大纲：${result.script!.storyOutline}`, `开场钩子：${result.script!.viralBreakdown.hook}`, `结构：${result.script!.viralBreakdown.structure.join(" → ")}`, `可复用规律：${result.script!.viralBreakdown.reusablePatterns.join("；")}`, `B 端改写建议：${result.script!.viralBreakdown.b2bAdaptation}`, ...(review ? [`内容策略评分：${review.score} 分｜${review.verdict}`, ...review.dimensions.map((item) => `${item.label}：${item.score} 分｜${item.verdict}｜${item.revisionAction}`)] : []), ...result.script!.beats.map((beat) => `${beat.startSec.toFixed(1)}–${beat.endSec.toFixed(1)} 秒｜${beat.visual}｜${beat.narration}｜${beat.purpose}`)].join("\n") })}>载入内容策略样本</button> : null}<p className="strategy-approved"><CheckCircle2 size={14}/> 请人工核对台词、镜头含义与抽取结论；确认后再引用到内容策略或视频生产。</p></> : null}
      <details className="video-evidence"><summary>查看提取证据（{result.transcript.length} 条台词、{result.scenes.length} 个场景）</summary>{result.warnings.map((warning) => <p key={warning}>{warning}</p>)}{result.transcript.slice(0, 12).map((item, index) => <p key={`${item.startSec}-${index}`}>{item.startSec.toFixed(1)}–{item.endSec.toFixed(1)} 秒｜{item.text}</p>)}{result.logs?.slice(-5).map((log, index) => <p key={`${log.at}-${index}`}>{log.level === "error" ? "错误" : "日志"}｜{log.message}</p>)}</details>
    </section>}
  </section>;
}
