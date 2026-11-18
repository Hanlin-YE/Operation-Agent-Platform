"use client";

import { FormEvent, useState } from "react";
import { Check, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { followUpDate, salesTimeZone } from "@/lib/sales/dailyWork";
import { FollowUp } from "@/server/data/types";

export function FollowUpForm({ leadId, followUps }: { leadId: string; followUps: FollowUp[] }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); setError("");
    const form = event.currentTarget;
    const payload = Object.fromEntries(new FormData(form).entries());
    try {
      const response = await fetch("/api/follow-ups", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...payload, leadId }) });
      if (!response.ok) { const result = await response.json(); throw new Error(result.error || "保存失败。"); }
      form.reset(); router.refresh();
    } catch (error) { setError(error instanceof Error ? error.message : "连接失败，请重试。"); }
    finally { setLoading(false); }
  }
  async function complete(id: string) {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/follow-ups", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status: "done" }) });
      if (!response.ok) throw new Error("保存失败，请重试。");
      router.refresh();
    } catch (error) { setError(error instanceof Error ? error.message : "连接失败，请重试。"); }
    finally { setLoading(false); }
  }

  return <section className="panel"><h2>跟进任务</h2>{error ? <p role="alert">{error}</p> : null}<form className="form-grid" onSubmit={submit}><div className="field"><label htmlFor={`followup-${leadId}-type`}>方式</label><select id={`followup-${leadId}-type`} name="type" defaultValue="call"><option value="call">电话</option><option value="wechat">微信</option><option value="email">邮件</option><option value="meeting">会议</option><option value="note">备注</option></select></div><div className="field"><label htmlFor={`followup-${leadId}-time`}>下次动作时间（北京时间）</label><input id={`followup-${leadId}-time`} name="nextActionAt" type="datetime-local" /></div><div className="field full"><label htmlFor={`followup-${leadId}-content`}>行动内容</label><textarea id={`followup-${leadId}-content`} name="content" required placeholder="例如：确认样品测试的工况、数量和负责人" /></div><button className="button" disabled={loading}><Plus size={16} />{loading ? "保存中" : "新建跟进"}</button></form>{followUps.filter((item) => item.status === "open").length ? <div className="timeline" style={{ marginTop: 16 }}>{followUps.filter((item) => item.status === "open").map((item) => <div className="timeline-item" key={item.id}><h3>{item.type}{item.nextActionAt ? ` · ${followUpDate(item.nextActionAt).toLocaleString("zh-CN", { timeZone: salesTimeZone })}` : ""}</h3><p className="subtle">{item.content}</p><button className="button secondary" disabled={loading} onClick={() => complete(item.id)}><Check size={15} />完成</button></div>)}</div> : <p className="subtle" style={{ marginTop: 14 }}>暂无待办跟进。</p>}</section>;
}
