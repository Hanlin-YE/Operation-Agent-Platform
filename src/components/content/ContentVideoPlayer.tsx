"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, ExternalLink, MessageSquareText, Play, Send, Video } from "lucide-react";
import {
  AssetReference,
  ContentCatalog,
  VideoCta,
  VideoVersion,
  emptyCatalog,
  formatDuration,
  getCtaId,
  getPublicationId,
  getVersionId,
  requestJson,
} from "@/components/content/contentOperationsClient";
import { ContentOperationsTabs } from "@/components/content/ContentOperationsTabs";

const thresholds = [25, 50, 75, 90, 100];

function sessionId() {
  if (typeof window === "undefined") return "server-session";
  const key = "content-operations-viewer-session";
  const existing = window.sessionStorage.getItem(key);
  if (existing) return existing;
  const created = crypto.randomUUID();
  window.sessionStorage.setItem(key, created);
  return created;
}

function eventId(eventName: string, suffix = "") {
  return `web_${eventName}_${suffix || Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function ContentVideoPlayer() {
  const [catalog, setCatalog] = useState<ContentCatalog>(emptyCatalog);
  const [versionId, setVersionId] = useState("");
  const [positionMs, setPositionMs] = useState(0);
  const [simulating, setSimulating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState({ comprehensionScore: 4, interestScore: 4, trustScore: 4, comment: "" });
  const [feedbackSent, setFeedbackSent] = useState(false);
  const sentProgress = useRef(new Set<number>());
  const impressedCtas = useRef(new Set<string>());
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    requestJson<ContentCatalog>("/api/content-operations/catalog", { cache: "no-store" })
      .then((payload) => {
        const next = { ...emptyCatalog, ...payload };
        setCatalog(next);
        const first = next.versions.find((item) => item.status === "published");
        setVersionId(first ? getVersionId(first) : "");
      })
      .catch((reason: Error) => setError(reason.message))
      .finally(() => setLoading(false));
  }, []);

  const version = catalog.versions.find((item) => getVersionId(item) === versionId) as VideoVersion | undefined;
  const ctas = useMemo(() => catalog.ctas.filter((item) => item.videoVersionId === versionId).sort((a, b) => a.startMs - b.startMs), [catalog.ctas, versionId]);
  const publication = catalog.publications.find((item) => item.videoVersionId === versionId && item.channel === "web");
  const videoAsset = catalog.assetReferences.find((item) => item.videoVersionId === versionId && item.assetType === "video") as AssetReference | undefined;
  const playableUrl = videoAsset?.referenceUrl && !videoAsset.referenceUrl.includes("example.invalid") ? videoAsset.referenceUrl : "";

  async function emit(eventName: "play_start" | "play_progress" | "cta_impression" | "cta_click" | "consultation_click", fields: Record<string, unknown> = {}) {
    if (!version) return;
    try {
      await requestJson("/api/content-operations/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: eventId(eventName, `${getVersionId(version)}_${fields.ctaId || fields.progressPercent || "root"}`),
          eventName,
          videoVersionId: getVersionId(version),
          publicationId: publication ? getPublicationId(publication) : undefined,
          sessionId: sessionId(),
          positionMs: Math.max(0, Math.round(fields.positionMs as number ?? positionMs)),
          ...fields,
        }),
      });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "事件上报失败");
    }
  }

  function handlePosition(nextMs: number, playing = false) {
    if (!version) return;
    const clamped = Math.min(version.durationMs, Math.max(0, Math.round(nextMs)));
    setPositionMs(clamped);
    if (playing) {
      const percent = Math.round(clamped / version.durationMs * 100);
      for (const threshold of thresholds) {
        if (percent >= threshold && !sentProgress.current.has(threshold)) {
          sentProgress.current.add(threshold);
          void emit("play_progress", { progressPercent: threshold, progressTrigger: "threshold", positionMs: Math.round(version.durationMs * threshold / 100) });
        }
      }
    }
    for (const cta of ctas) {
      const ctaId = getCtaId(cta);
      if (ctaId && clamped >= cta.startMs && clamped <= cta.endMs && !impressedCtas.current.has(ctaId)) {
        impressedCtas.current.add(ctaId);
        void emit("cta_impression", { ctaId, positionMs: clamped });
      }
    }
  }

  function chooseVersion(nextId: string) {
    setVersionId(nextId);
    setPositionMs(0);
    sentProgress.current.clear();
    impressedCtas.current.clear();
    setFeedbackSent(false);
    setNotice("");
  }

  function startPlayback() {
    setSimulating(true);
    void emit("play_start", { positionMs });
    if (videoRef.current) void videoRef.current.play().catch(() => undefined);
  }

  function clickCta(cta: VideoCta) {
    const ctaId = getCtaId(cta);
    if (!ctaId) return;
    void emit("cta_click", { ctaId, targetAgentId: cta.targetAgentId, positionMs: Math.min(Math.max(positionMs, cta.startMs), cta.endMs) });
    setNotice(`已记录 CTA：${cta.label}`);
  }

  function consultCta(cta: VideoCta) {
    const ctaId = getCtaId(cta);
    if (!ctaId) return;
    void emit("consultation_click", { ctaId, targetAgentId: cta.targetAgentId, positionMs: Math.min(Math.max(positionMs, cta.startMs), cta.endMs) });
    setNotice("已记录咨询入口点击，可由协作者客户端继续承接。");
  }

  async function submitFeedback(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!version) return;
    setError("");
    try {
      const result = await requestJson<{ feedbackId: string }>("/api/content-operations/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoVersionId: getVersionId(version), sessionId: sessionId(), ...feedback, positionMs }),
      });
      await requestJson("/api/content-operations/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId: eventId("feedback_submit", result.feedbackId), eventName: "feedback_submit", videoVersionId: getVersionId(version), sessionId: sessionId(), feedbackId: result.feedbackId, positionMs }),
      });
      setFeedbackSent(true);
      setNotice("反馈已记录，感谢你的观看。");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "反馈提交失败");
    }
  }

  return <div className="content-operations">
    <ContentOperationsTabs current="player" />
    <div className="page-head content-page-head"><div><p className="eyebrow">Web Viewer</p><h1>内容观看与反馈</h1><p className="subtle">这是面向真实观看者的网页播放器，行为数据会进入内容运营分析。</p></div></div>
    {loading && <div className="panel">正在加载可观看版本...</div>}
    {!loading && !version && <div className="panel"><Video size={18} /> 暂无已发布视频版本，请先在发布记录中登记并发布。</div>}
    {version && <div className="grid cols-2 content-player-layout">
      <section className="panel content-player-panel">
        <div className="toolbar"><label>视频版本<select value={versionId} onChange={(event) => chooseVersion(event.target.value)}>{catalog.versions.filter((item) => item.status === "published").map((item) => <option key={getVersionId(item)} value={getVersionId(item)}>{item.versionNumber}</option>)}</select></label><span className="badge grade-A">网页渠道</span></div>
        <div className="content-video-frame">
          {playableUrl ? <video ref={videoRef} controls preload="metadata" src={playableUrl} onPlay={() => void emit("play_start", { positionMs: Math.round((videoRef.current?.currentTime || 0) * 1000) })} onTimeUpdate={() => handlePosition((videoRef.current?.currentTime || 0) * 1000, true)} onEnded={() => handlePosition(version.durationMs, true)} /> : <div className="content-player-simulator"><Play size={32} /><strong>演示时间轴</strong><span>未登记可播放的视频地址</span><button className="button primary" type="button" onClick={startPlayback}><Play size={15} />开始演示</button></div>}
        </div>
        <div className="content-player-progress"><div className="progress-track"><span style={{ width: `${Math.min(100, positionMs / version.durationMs * 100)}%` }} /></div><span>{formatDuration(positionMs)} / {formatDuration(version.durationMs)}</span></div>
        {!playableUrl && <input aria-label="演示播放进度" type="range" min="0" max={version.durationMs} value={positionMs} onChange={(event) => handlePosition(Number(event.target.value), simulating)} />}
        <div className="content-cta-list">{ctas.length === 0 ? <span className="subtle">该版本暂无 CTA</span> : ctas.map((cta) => { const active = positionMs >= cta.startMs && positionMs <= cta.endMs; return <div key={getCtaId(cta) || `${cta.startMs}-${cta.endMs}`} className={`content-cta-row${active ? " active" : ""}`}><div><strong>{cta.label}</strong><span>{formatDuration(cta.startMs)} - {formatDuration(cta.endMs)}</span></div><div className="button-row"><button className="button secondary" type="button" onClick={() => clickCta(cta)}><ExternalLink size={14} />点击 CTA</button><button className="button primary" type="button" onClick={() => consultCta(cta)}><MessageSquareText size={14} />咨询协作者</button></div></div>; })}</div>
      </section>
      <section className="panel"><h2>观看反馈</h2><p className="subtle">完成观看或触发 CTA 后，邀请观众留下结构化反馈。</p><form className="content-feedback-form" onSubmit={submitFeedback}><div className="grid cols-3">{([['comprehensionScore', '理解度'], ['interestScore', '兴趣度'], ['trustScore', '信任度']] as const).map(([key, label]) => <label key={key}>{label}<select value={feedback[key]} onChange={(event) => setFeedback((current) => ({ ...current, [key]: Number(event.target.value) }))}>{[1, 2, 3, 4, 5].map((score) => <option key={score} value={score}>{score} / 5</option>)}</select></label>)}</div><label>补充说明<textarea value={feedback.comment} maxLength={500} rows={5} placeholder="可选：哪一段最难理解？" onChange={(event) => setFeedback((current) => ({ ...current, comment: event.target.value }))} /></label><button className="button primary" type="submit" disabled={feedbackSent}><Send size={15} />{feedbackSent ? "已提交反馈" : "提交反馈"}</button></form>{feedbackSent && <p className="notice success"><CheckCircle2 size={15} />反馈已进入分析数据集</p>}{notice && <p className="notice">{notice}</p>}{error && <p className="notice error">{error}</p>}</section>
    </div>}
  </div>;
}
