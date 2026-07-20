"use client";

import { FormEvent, useState } from "react";
import { CheckCircle2, CircleAlert, Clapperboard, FileVideo, LoaderCircle, Upload } from "lucide-react";
import type { VideoAnalysisResult } from "@/server/videoAnalysis/service";

export function VideoAnalysisWorkbench() {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<VideoAnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function analyze(event: FormEvent) {
    event.preventDefault();
    if (!file) return setError("请先选择一个视频文件。");
    setLoading(true); setError(""); setResult(null);
    const form = new FormData(); form.set("video", file);
    try {
      const response = await fetch("/api/video-analysis", { method: "POST", body: form });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "视频分析失败。");
      setResult(payload as VideoAnalysisResult);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "视频分析失败。"); }
    finally { setLoading(false); }
  }

  return <section className="video-analysis-workbench">
    <form className="panel video-analysis-intake" onSubmit={analyze}>
      <div className="strategy-heading"><div><p className="eyebrow">Video reference analysis</p><h2>视频拆解与剧本提取</h2></div><Clapperboard size={20} /></div>
      <p className="subtle">视频仅用于本次拆解：提取台词、场景时间轴与可编辑剧本。分析完成后仍需人工确认，不能直接进入生产。</p>
      <label className="video-analysis-upload"><Upload size={18}/><span>{file ? file.name : "选择视频文件"}<small>{file ? `${Math.ceil(file.size / 1024 / 1024)} MB` : "MP4、MOV、WebM · 最大 300MB"}</small></span><input type="file" accept="video/mp4,video/quicktime,video/webm" onChange={(event) => setFile(event.target.files?.[0] || null)} /></label>
      <button className="button" disabled={loading}>{loading ? <LoaderCircle className="spin" size={16}/> : <FileVideo size={16}/>} {loading ? "正在提取证据…" : "开始拆解"}</button>
      {error && <p className="run-error"><CircleAlert size={16}/>{error}</p>}
    </form>
    {result && <section className="panel video-analysis-result">
      <div className="strategy-heading"><div><p className="eyebrow">Evidence-backed script</p><h2>{result.script?.title || "视频证据已登记"}</h2></div><span className={`strategy-chip ${result.status === "needs_review" ? "approved" : "neutral"}`}>{result.status === "needs_review" ? "等待人工审核" : "等待模型配置"}</span></div>
      {result.status === "model_not_configured" ? <div className="strategy-notice"><CircleAlert size={17}/><div><strong>模型尚未配置</strong><p>已完成本地证据提取；配置统一模型后才能把证据整理为剧本，不会生成模拟内容。</p></div></div> : null}
      {result.script ? <><p className="video-script-summary">{result.script.summary}</p><div className="video-beat-table"><div className="video-beat-head"><span>时间</span><span>画面与台词</span><span>段落目的</span></div>{result.script.beats.map((beat, index) => <div className="video-beat-row" key={`${beat.startSec}-${index}`}><time>{beat.startSec.toFixed(1)}–{beat.endSec.toFixed(1)} 秒</time><p><b>{beat.visual}</b>{beat.narration}</p><span>{beat.purpose}</span></div>)}</div><p className="strategy-approved"><CheckCircle2 size={14}/> 请人工核对台词、镜头含义与抽取结论；确认后再引用到内容策略或视频生产。</p></> : null}
      <details className="video-evidence"><summary>查看提取证据（{result.transcript.length} 条台词、{result.scenes.length} 个场景）</summary>{result.warnings.map((warning) => <p key={warning}>{warning}</p>)}</details>
    </section>}
  </section>;
}
