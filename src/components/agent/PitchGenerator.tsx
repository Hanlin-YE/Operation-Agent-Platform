"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MessageSquareText, Save } from "lucide-react";
import { GeneratedPitch, PitchChannel } from "@/server/data/types";
import { checkPitchCompliance } from "@/lib/sales/pitchCompliance";

const channelOptions: { value: PitchChannel; label: string }[] = [
  { value: "phone", label: "电话开场白" }, { value: "wechat", label: "微信首次触达" },
  { value: "email", label: "邮件开发信" }, { value: "quote_followup", label: "报价后跟进" },
  { value: "price_objection", label: "价格异议处理" }, { value: "technical_confirm", label: "技术参数确认" }
];

export function PitchGenerator({ leadId, initialPitch }: { leadId: string; initialPitch?: GeneratedPitch }) {
  const router = useRouter();
  const [channel, setChannel] = useState<PitchChannel>(initialPitch?.channel || "phone");
  const [pitch, setPitch] = useState(initialPitch);
  const [content, setContent] = useState(initialPitch?.content || "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const issues = checkPitchCompliance(content);
  const dirty = content.trim() !== pitch?.content.trim();

  async function request(url: string, method: string, body: unknown) {
    const response = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const result = await response.json();
    if (!response.ok) throw new Error([result.error || "操作失败，请重试。", ...(result.issues || [])].join(" "));
    return result;
  }

  async function act(action: "generate" | "save" | "followup") {
    setBusy(true); setError(""); setMessage("");
    try {
      if (action === "generate") {
        const nextPitch: GeneratedPitch = await request("/api/agent/generate-pitch", "POST", { leadId, channel });
        setPitch(nextPitch); setContent(nextPitch.content); setMessage("话术已生成并保存，请审核后使用。");
      } else if (pitch) {
        const updated: GeneratedPitch = await request(`/api/pitches/${pitch.id}`, "PATCH", { content });
        setPitch(updated); setContent(updated.content);
        if (action === "followup") {
          await request("/api/follow-ups", "POST", {
            leadId, pitchId: updated.id,
            type: updated.channel === "email" ? "email" : updated.channel === "wechat" ? "wechat" : "call",
            content: updated.content
          });
          setMessage("当前话术已保存，并加入待跟进任务。");
        } else setMessage("话术修改已保存。");
      }
      router.refresh();
    } catch (error) { setError(error instanceof Error ? error.message : "连接失败，请重试。"); }
    finally { setBusy(false); }
  }

  return <div className="panel">
    <h2>专业销售话术</h2>
    <div className="actions">
      <label>生成渠道 <select value={channel} disabled={busy} onChange={(event) => setChannel(event.target.value as PitchChannel)}>{channelOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
      <button className="button" onClick={() => act("generate")} disabled={busy}><MessageSquareText size={17} />{busy ? "处理中" : "生成话术"}</button>
      <button className="button secondary" onClick={() => act("save")} disabled={busy || !pitch || !content.trim() || !!issues.length}>保存话术</button>
      <button className="button secondary" onClick={() => act("followup")} disabled={busy || !pitch || !content.trim() || !!issues.length}><Save size={17} />保存为跟进任务</button>
    </div>
    <p className="subtle" style={{ marginTop: 12 }}>参数承诺检查按规则拦截保证用语及量化参数，仍需人工确认事实与工况。具体性能以技术验证和书面确认为准。</p>
    {error ? <p role="alert">{error}</p> : null}
    {message ? <p role="status">{message}</p> : null}
    {pitch ? <div style={{ marginTop: 14 }}>
      <p className="subtle">当前话术：{pitch.scenario}{dirty ? " · 有未保存修改" : ""}</p>
      <textarea className="pitch-box" value={content} disabled={busy} onChange={(event) => { setContent(event.target.value); setMessage(""); }} aria-label="编辑销售话术" />
      {issues.length ? <div role="alert"><strong>请先修改以下内容：</strong><ul>{issues.map((issue) => <li key={issue}>{issue}</li>)}</ul></div> : null}
      <p className="subtle" style={{ marginTop: 10 }}>{pitch.rationale}</p>
      <div className="badge-row">{pitch.citations.map((citation) => <span className="badge" key={citation}>{citation}</span>)}</div>
    </div> : <p className="subtle" style={{ marginTop: 14 }}>选择销售场景后生成话术，内容结合客户资料、产品资料和销售知识库。</p>}
  </div>;
}
