"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FollowUp, Lead } from "@/server/data/types";
import { followUpDate, salesTimeZone } from "@/lib/sales/dailyWork";

export function DailyFollowUps({ title, items }: { title: string; items: { task: FollowUp; lead: Lead }[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string>();
  const [error, setError] = useState("");
  async function complete(id: string) {
    setBusy(id); setError("");
    try {
      const response = await fetch("/api/follow-ups", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status: "done" }) });
      if (!response.ok) throw new Error("任务保存失败，请重试。");
      router.refresh();
    } catch (error) { setError(error instanceof Error ? error.message : "连接失败，请重试。"); }
    finally { setBusy(undefined); }
  }
  return <section className="panel">
    <h2>{title} <span className="badge">{items.length}</span></h2>
    {error ? <p role="alert">{error}</p> : null}
    {items.length ? <div className="sales-task-list">{items.map(({ task, lead }) => <article className="sales-task" key={task.id}>
      <div><a href={`/leads/${lead.id}`}><strong>{lead.companyName}</strong></a><p className="subtle">{lead.contactName} · {lead.contactMethod}</p></div>
      <p>{task.content}</p>
      <div className="actions"><span className="subtle">{task.nextActionAt && Number.isFinite(followUpDate(task.nextActionAt).getTime()) ? followUpDate(task.nextActionAt).toLocaleString("zh-CN", { timeZone: salesTimeZone, month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "尚未安排时间"}</span><a className="button secondary" href={`/leads/${lead.id}`}>查看线索</a><button className="button secondary" disabled={!!busy} onClick={() => complete(task.id)}>{busy === task.id ? "保存中" : "标记完成"}</button></div>
    </article>)}</div> : <p className="subtle">暂无{title}。</p>}
  </section>;
}
