"use client";

import { FormEvent, useEffect, useState } from "react";

type Comment = { id: string; articleId: string; content: string; createdAt: string; status: string };
type Dashboard = { total: number; valid: number; themes: { name: string; count: number }[]; sentiment: Record<string, number>; risks: { type: string; count: number }[]; articles: { id: string; title: string; publishedAt: string }[]; comments: Comment[]; source?: { mode: string; note: string } };

function toLocalDateTime(value: Date) { return value.toISOString().slice(0, 16); }

export function WechatCommentsWorkbench({ initial }: { initial: Dashboard }) {
  const [dashboard, setDashboard] = useState(initial); const [message, setMessage] = useState(""); const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState(""); const [jobs, setJobs] = useState<{ id: string; articleQuery: string; status: string; maxPages: number; inserted?: number; error?: string }[]>([]);
  const [articleTitle, setArticleTitle] = useState("精密电机选型与可靠性"); const [publishedAt, setPublishedAt] = useState(toLocalDateTime(new Date()));
  const [commentsText, setCommentsText] = useState("想了解温升、寿命和交期，能否提供样品测试？\n设备连续运行时，维护周期大概多久？");
  async function refresh() { const response = await fetch("/api/wechat-comments", { cache: "no-store" }); setDashboard(await response.json()); }
  async function refreshJobs() { const response = await fetch("/api/wechat-operator-jobs", { cache: "no-store" }); setJobs(await response.json()); }
  useEffect(() => { refresh().catch(() => undefined); refreshJobs().catch(() => undefined); }, []);
  async function createJob(event: FormEvent) {
    event.preventDefault(); if (!searchQuery.trim()) { setMessage("请填写文章标题或唯一搜索词。 "); return; }
    setLoading(true); setMessage("");
    try { const response = await fetch("/api/wechat-operator-jobs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ articleQuery: searchQuery, maxPages: 1 }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error || "创建任务失败"); setSearchQuery(""); setMessage("采集任务已创建，等待已授权的专用采集机执行。 "); await refreshJobs(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "创建任务失败"); } finally { setLoading(false); }
  }
  async function importComments(event: FormEvent) {
    event.preventDefault(); const lines = commentsText.split("\n").map((item) => item.trim()).filter(Boolean);
    if (!articleTitle.trim() || !lines.length) { setMessage("请填写文章标题，并至少录入一条评论。 "); return; }
    setLoading(true); setMessage("");
    const now = new Date().toISOString(); const articleId = `manual-${Date.now()}`;
    const payload = { article: { id: articleId, title: articleTitle.trim(), publishedAt: new Date(publishedAt).toISOString() }, comments: lines.map((content, index) => ({ id: `${articleId}-comment-${index + 1}`, articleId, content, createdAt: now, status: "visible" })) };
    try { const response = await fetch("/api/wechat-comments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }); const data = await response.json(); if (!response.ok) throw new Error(data.error || "导入失败"); setMessage(`已同步 ${data.inserted} 条评论，重复 ${data.duplicates} 条。`); await refresh(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "评论同步失败"); } finally { setLoading(false); }
  }
  return <div className="content-review-grid">
    <section className="panel comment-entry-panel"><p className="eyebrow">Controlled operator</p><h2>微信后台补数任务</h2><p className="subtle">采集机必须由运营人员在自有公众号后台人工登录；网页端不保存密码或 Cookie，回传接口需要内部令牌验证。</p><form className="form-grid" onSubmit={createJob}><label className="field full"><span>文章标题或唯一搜索词</span><input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="例如：空心杯电机选型" /></label><button className="button" disabled={loading}>{loading ? "处理中…" : "创建采集任务"}</button></form><div className="timeline" style={{ marginTop: 14 }}>{jobs.length ? jobs.slice(0, 5).map((job) => <div className="timeline-item" key={job.id}><strong>{job.articleQuery}</strong><p className="subtle">{job.status} · 最多 {job.maxPages} 页{job.inserted !== undefined ? ` · 新增 ${job.inserted} 条` : ""}{job.error ? ` · ${job.error}` : ""}</p></div>) : <p className="subtle">暂无待执行的补数任务。</p>}</div></section>
    <section className="panel comment-entry-panel"><p className="eyebrow">评论录入</p><h2>导入已授权的公众号评论</h2><p className="subtle">填写文章信息后，每行粘贴一条评论。系统会在服务端保存原始评论并生成可追溯的主题、情绪和风险归纳。</p><form className="form-grid" onSubmit={importComments}><label className="field"><span>文章标题</span><input value={articleTitle} onChange={(event) => setArticleTitle(event.target.value)} /></label><label className="field"><span>发布时间</span><input type="datetime-local" value={publishedAt} onChange={(event) => setPublishedAt(event.target.value)} /></label><label className="field full"><span>评论内容</span><textarea value={commentsText} onChange={(event) => setCommentsText(event.target.value)} placeholder="每行一条评论" /><small>一行一条；只录入已获得授权的数据。</small></label><button className="button" disabled={loading}>{loading ? "正在同步…" : "同步评论并分析"}</button></form>{message && <p className="subtle">{message}</p>}</section>
    <section className="panel"><p className="eyebrow">评论概览</p><h2>用户数据分析</h2><div className="stats-grid"><div className="stat"><strong>{dashboard.total || 0}</strong><p className="subtle">评论总数</p></div><div className="stat"><strong>{dashboard.valid || 0}</strong><p className="subtle">有效评论</p></div><div className="stat"><strong>{dashboard.sentiment?.negative || 0}</strong><p className="subtle">负向信号</p></div></div><h3>主题与痛点</h3>{(dashboard.themes || []).slice(0, 8).map((item) => <div className="timeline-item" key={item.name}><strong>{item.name}</strong><span className="subtle"> · {item.count} 条</span></div>)}<h3>风险与线索</h3>{(dashboard.risks || []).map((item) => <div className="timeline-item" key={item.type}><strong>{item.type}</strong><span className="subtle"> · {item.count} 条，需人工审核</span></div>)}<p className="subtle">来源状态：{dashboard.source?.mode || "本地演示数据"}。模型结论仅作归纳，不自动建客或触达。</p></section>
    <section className="panel comment-table-panel"><p className="eyebrow">原始评论</p><h2>已同步评论</h2>{dashboard.comments.length ? <div className="comment-table-wrap"><table className="table comment-table"><thead><tr><th>文章</th><th>评论内容</th><th>时间</th><th>状态</th></tr></thead><tbody>{dashboard.comments.slice(0, 50).map((comment) => <tr key={comment.id}><td>{dashboard.articles.find((article) => article.id === comment.articleId)?.title || comment.articleId}</td><td>{comment.content}</td><td>{new Date(comment.createdAt).toLocaleString()}</td><td>{comment.status === "visible" ? "可见" : comment.status}</td></tr>)}</tbody></table></div> : <p className="subtle">尚未同步评论。</p>}</section>
  </div>;
}
