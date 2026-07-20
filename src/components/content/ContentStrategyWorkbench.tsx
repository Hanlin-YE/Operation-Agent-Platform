"use client";
/* Local object URLs are intentionally rendered as native images for immediate upload previews. */
/* eslint-disable @next/next/no-img-element */

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { Check, CheckCircle2, CircleAlert, FileSearch, ImagePlus, LoaderCircle, LockKeyhole, Send, ShieldAlert, Trash2 } from "lucide-react";
import type { ContentStrategyPack } from "@/server/data/types";

const initial = { platform: "xiaohongshu", title: "", content: "", sourceUrl: "", views: "", likes: "", comments: "", saves: "", shares: "" };
const actions = { wechat: "公众号长文", xhsImage: "小红书图文", xhsVideo: "小红书短视频" } as const;

function StatusChip({ item }: { item: ContentStrategyPack | null }) {
  if (!item) return <span className="strategy-chip neutral">等待样本</span>;
  const labels = { needs_review: "待审核", approved: "已批准", model_not_configured: "模型未配置", error: "分析异常", superseded: "已退回", rework_pending: "待配置后返修", rework_processing: "返修中", rework_failed: "返修失败" } as const;
  return <span className={`strategy-chip ${item.status}`}>{labels[item.status]}</span>;
}

export function ContentStrategyWorkbench() {
  const [form, setForm] = useState(initial);
  const [files, setFiles] = useState<File[]>([]);
  const [item, setItem] = useState<ContentStrategyPack | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [reworkReason, setReworkReason] = useState("");
  const [reworking, setReworking] = useState(false);
  const [versions, setVersions] = useState<ContentStrategyPack[]>([]);
  const previews = useMemo(() => files.map((file) => ({ file, url: URL.createObjectURL(file) })), [files]);
  useEffect(() => () => previews.forEach(({ url }) => URL.revokeObjectURL(url)), [previews]);
  useEffect(() => { if (!item) return; fetch(`/api/content-strategies/${item.id}/versions`, { cache: "no-store" }).then((response) => response.json()).then((payload) => { if (Array.isArray(payload)) setVersions(payload); }).catch(() => undefined); }, [item]);

  const evidenceCount = [form.title, form.content, form.sourceUrl, form.views || form.likes || form.comments || form.saves || form.shares].filter(Boolean).length;
  const completeness = Math.round((evidenceCount / 4) * 100);
  const analysis = item?.analysis;

  function setField(key: keyof typeof form, value: string) { setForm((current) => ({ ...current, [key]: value })); }
  function selectFiles(event: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files || []);
    const tooLarge = selected.find((file) => file.size > 5 * 1024 * 1024);
    if (tooLarge) setMessage(`${tooLarge.name} 超过 5MB，未加入样本。`);
    setFiles(selected.filter((file) => file.type.startsWith("image/") && file.size <= 5 * 1024 * 1024).slice(0, 3));
    event.target.value = "";
  }
  async function analyze(event: FormEvent) {
    event.preventDefault(); setLoading(true); setMessage("");
    const data = new FormData(); Object.entries(form).forEach(([key, value]) => data.set(key, value)); files.forEach((file) => data.append("images", file));
    try { const response = await fetch("/api/content-strategies", { method: "POST", body: data }); const payload = await response.json(); if (!response.ok) throw new Error(payload.error || "分析失败"); setItem(payload); }
    catch (error) { setMessage(error instanceof Error ? error.message : "分析失败"); } finally { setLoading(false); }
  }
  async function approve() {
    if (!item) return; const response = await fetch(`/api/content-strategies/${item.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "approved", operator: "当前运营人员" }) }); const payload = await response.json(); if (response.ok) setItem(payload); else setMessage(payload.error || "审核更新失败");
  }
  async function confirmProduction() {
    if (!item) return;
    const confirmed = window.confirm("确认按当前策略进入内容生产？确认后才会解锁生成入口，仍不会自动发布。");
    if (!confirmed) return;
    const response = await fetch(`/api/content-strategies/${item.id}/confirm-production`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ operator: "当前运营人员" }) });
    const payload = await response.json(); if (response.ok) setItem(payload); else setMessage(payload.error || "生产确认失败");
  }
  async function handoff() { if (!item) return; const response = await fetch(`/api/content-strategies/${item.id}/create-draft`, { method: "POST" }); const payload = await response.json(); setMessage(response.ok ? payload.message : payload.error || "交接失败"); }
  async function requestRework(stage: "strategy_review" | "production_confirmation" | "production_draft") {
    const effectiveReason = reworkReason.trim() || item?.rework?.reason || "";
    if (!item || !effectiveReason) { setMessage("请先填写具体返工需求。 "); return; }
    if (!window.confirm("确认按输入的需求打回并交给模型返修？旧版本将立即停止生产。")) return;
    setReworking(true); const response = await fetch(`/api/content-strategies/${item.id}/request-rework`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ stage, reason: effectiveReason, operator: "当前运营人员" }) });
    const payload = await response.json(); setReworking(false); if (response.ok) { setItem(payload); setReworkReason(""); setMessage(payload.status === "needs_review" ? "返修完成，新版本需重新审核。" : "返修需求已保存，配置模型后可重试。"); } else setMessage(payload.error || "返工请求失败");
  }

  return <section className="strategy-workbench">
    <form className="panel strategy-intake" onSubmit={analyze}>
      <div className="strategy-heading"><div><p className="eyebrow">01 / Sample archive</p><h2>样本档案</h2></div><span className="strategy-meter">{completeness}% 完整</span></div>
      <div className="strategy-progress"><i style={{ width: `${completeness}%` }} /></div>
      <p className="subtle strategy-caption">仅使用人工粘贴和主动上传的内容，分析结果会保留证据边界。</p>
      <label className="field"><span>来源平台</span><select value={form.platform} onChange={(e) => setField("platform", e.target.value)}><option value="xiaohongshu">小红书</option><option value="wechat">公众号</option><option value="douyin">抖音</option><option value="other">其他</option></select></label>
      <label className="field"><span>标题 <em>必填</em></span><input required value={form.title} onChange={(e) => setField("title", e.target.value)} placeholder="粘贴对标标题" /></label>
      <label className="field"><span>正文 / 字幕 <em>必填</em></span><textarea required value={form.content} onChange={(e) => setField("content", e.target.value)} placeholder="粘贴正文、字幕或脚本；最多 12,000 字符" maxLength={12000} /><small>{form.content.length.toLocaleString()} / 12,000</small></label>
      <label className="field"><span>对标链接 <b>可选</b></span><input type="url" value={form.sourceUrl} onChange={(e) => setField("sourceUrl", e.target.value)} placeholder="https://" /></label>
      <div className="strategy-metrics"><div className="strategy-subhead">人工指标 <b>缺失也可分析</b></div>{[["views", "浏览"], ["likes", "点赞"], ["comments", "评论"], ["saves", "收藏"], ["shares", "分享"]].map(([key, label]) => <label className="field" key={key}><span>{label}</span><input type="number" min="0" value={form[key as keyof typeof form]} onChange={(e) => setField(key as keyof typeof form, e.target.value)} /></label>)}</div>
      <div className="strategy-subhead">视觉样本 <b>最多 3 张 · 单张 5MB</b></div>
      <label className="strategy-upload"><ImagePlus size={16}/><span>添加图片样本</span><input type="file" accept="image/*" multiple onChange={selectFiles} /></label>
      {previews.length > 0 && <div className="strategy-thumbs">{previews.map(({ file, url }, index) => <div className="strategy-thumb" key={`${file.name}-${index}`}><img src={url} alt={`样本 ${index + 1}`} /><button type="button" aria-label={`移除 ${file.name}`} onClick={() => setFiles((current) => current.filter((_, currentIndex) => currentIndex !== index))}><Trash2 size={13}/></button><small>{Math.ceil(file.size / 1024)}KB</small></div>)}</div>}
      <button className="button strategy-submit" disabled={loading}>{loading ? <LoaderCircle className="spin" size={16}/> : <FileSearch size={16}/>} {loading ? "正在建立证据链…" : "生成策略包"}</button>
    </form>

    <section className="panel strategy-result">
      <div className="strategy-heading"><div><p className="eyebrow">02 / Evidence canvas</p><h2>证据画布</h2></div><div className="strategy-version">V{item?.version || 1} <StatusChip item={item}/></div></div>
      {loading && <div className="strategy-skeleton" aria-label="策略分析中"><i/><i/><i/><i/></div>}
      {!loading && !item && <div className="strategy-empty"><FileSearch size={22}/><strong>等待一份对标样本</strong><p>策略包会按证据、钩子、结构、受众和风险逐层展开。</p></div>}
      {!loading && item?.status === "model_not_configured" && <div className="strategy-notice"><CircleAlert size={17}/><div><strong>模型尚未配置</strong><p>样本已登记，但没有生成模拟分析。请在服务端配置 <code>OPENAI_API_KEY</code> 后重新提交。</p></div></div>}
      {!loading && item?.status === "error" && <div className="strategy-notice danger"><CircleAlert size={17}/><div><strong>策略包未生成</strong><p>{item.error}</p></div></div>}
      {!loading && analysis && <div className="strategy-sections">
        <article className="evidence-section"><small><span className="evidence-dot fact"/> 证据完整度 · {analysis.confidence}</small><h3>样本说了什么</h3><p>{analysis.evidence.join("；") || "未发现可用证据"}</p><p className="muted">待补充：{analysis.missingData.join("；") || "无"}</p></article>
        <article><small><span className="evidence-dot inference"/> 钩子与结构</small><h3>{analysis.hook}</h3><p><b>结构</b>　{analysis.structure.join(" → ")}</p><p><b>节奏</b>　{analysis.rhythm}</p></article>
        <article><small><span className="evidence-dot method"/> 受众与可复用方法</small><h3>{analysis.audience}</h3><p>{analysis.reusableMethods.join("；")}</p></article>
        <article className="risk"><small><ShieldAlert size={13}/> B2B 风险与证据要求</small><h3>发布前需要核验</h3><p>{analysis.b2bRisks.join("；")}</p><p>{analysis.evidenceRequirements.join("；")}</p></article>
      </div>}
      {versions.length > 0 && <div className="strategy-rework-history"><strong>版本时间线</strong>{versions.map((version) => <div key={version.id}><p>V{version.version} · {version.status}{version.rework ? ` · ${version.rework.reason}` : ""}</p><small>{version.rework ? `${version.rework.operator} · ${new Date(version.rework.requestedAt).toLocaleString()}` : new Date(version.createdAt).toLocaleString()}</small></div>)}</div>}
    </section>

    <aside className="panel strategy-actions">
      <div className="strategy-heading"><div><p className="eyebrow">03 / Review gate</p><h2>审核与交接</h2></div><StatusChip item={item}/></div>
      <div className="strategy-gate"><LockKeyhole size={15}/><span>{item?.productionConfirmation ? "已由运营人员确认，可进入内容生产" : item?.status === "approved" ? "策略已审核，仍需人工确认后才能继续生成" : "审核通过前，生产动作保持锁定"}</span></div>
      {item?.status === "needs_review" && <div className="strategy-review"><button className="button" type="button" onClick={approve}><Check size={15}/>审核通过</button></div>}
      {item && !["superseded", "rework_processing"].includes(item.status) && <div className="strategy-rework"><label><span>返修需求 <em>必填</em></span><textarea value={reworkReason} onChange={(event) => setReworkReason(event.target.value)} placeholder="描述哪些内容保留或修改、目标语气、结构、平台方向，以及需要补充的证据" /></label><button className="button ghost" disabled={reworking} type="button" onClick={() => requestRework(item.productionDraft ? "production_draft" : item.productionConfirmation || item.status === "approved" ? "production_confirmation" : "strategy_review")}>{reworking ? <><LoaderCircle className="spin" size={14}/>模型返修中…</> : ["rework_pending", "rework_failed"].includes(item.status) ? "重试返修" : "打回并按需求返修"}</button></div>}
      {item?.status === "approved" && !item.productionConfirmation && <button className="button strategy-confirm" type="button" onClick={confirmProduction}><CheckCircle2 size={15}/>确认策略，解锁生成</button>}
      {(Object.keys(actions) as Array<keyof typeof actions>).map((key) => <article key={key} className={item?.productionConfirmation ? "ready" : "locked"}><small>{item?.productionConfirmation ? "已确认，可生成" : item?.status === "approved" ? "等待生产确认" : "需审核"}</small><h3>{actions[key]}</h3><p>{analysis?.recommendations[key] || "审核后的平台方向将显示在这里。"}</p><button className="button secondary" disabled={!item?.productionConfirmation} onClick={handoff}>{item?.productionConfirmation ? <><Send size={13}/>创建生产草稿</> : "确认后可用"}</button></article>)}
      {message ? <p className="strategy-message">{message}</p> : null}
      {item?.productionConfirmation && <p className="strategy-approved"><CheckCircle2 size={14}/> 已确认生产上下文；仍需在后续工作台人工发起生成与发布。</p>}
    </aside>
  </section>;
}
