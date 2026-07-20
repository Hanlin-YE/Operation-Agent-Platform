"use client";

import { FormEvent, useState } from "react";
import { Check, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { FollowUp } from "@/server/data/types";

export function FollowUpForm({ leadId, followUps }: { leadId: string; followUps: FollowUp[] }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true);
    const payload = Object.fromEntries(new FormData(event.currentTarget).entries());
    const response = await fetch("/api/follow-ups", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...payload, leadId }) });
    setLoading(false);
    if (response.ok) { event.currentTarget.reset(); router.refresh(); }
  }
  async function complete(id: string) {
    const response = await fetch("/api/follow-ups", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status: "done" }) });
    if (response.ok) router.refresh();
  }

  return <section className="panel"><h2>跟进任务</h2><form className="form-grid" onSubmit={submit}><div className="field"><label>方式</label><select name="type" defaultValue="call"><option value="call">电话</option><option value="wechat">微信</option><option value="email">邮件</option><option value="meeting">会议</option><option value="note">备注</option></select></div><div className="field"><label>下次动作时间</label><input name="nextActionAt" type="datetime-local" /></div><div className="field full"><label>行动内容</label><textarea name="content" required placeholder="例如：确认样品测试的工况、数量和负责人" /></div><button className="button" disabled={loading}><Plus size={16} />{loading ? "保存中" : "新建跟进"}</button></form>{followUps.filter((item) => item.status === "open").length ? <div className="timeline" style={{ marginTop: 16 }}>{followUps.filter((item) => item.status === "open").map((item) => <div className="timeline-item" key={item.id}><h3>{item.type}{item.nextActionAt ? ` · ${new Date(item.nextActionAt).toLocaleString("zh-CN")}` : ""}</h3><p className="subtle">{item.content}</p><button className="button secondary" onClick={() => complete(item.id)}><Check size={15} />完成</button></div>)}</div> : <p className="subtle" style={{ marginTop: 14 }}>暂无待办跟进。</p>}</section>;
}
