"use client";

import { awaitBackgroundResult } from "@/components/content/backgroundTaskClient";
import { useState } from "react";
import { MessageSquareText, Save } from "lucide-react";
import { GeneratedPitch, PitchChannel } from "@/server/data/types";

const channelOptions: { value: PitchChannel; label: string }[] = [
  { value: "phone", label: "电话开场白" },
  { value: "wechat", label: "微信首次触达" },
  { value: "email", label: "邮件开发信" },
  { value: "quote_followup", label: "报价后跟进" },
  { value: "price_objection", label: "价格异议处理" },
  { value: "technical_confirm", label: "技术参数确认" }
];

export function PitchGenerator({ leadId, initialPitch }: { leadId: string; initialPitch?: GeneratedPitch }) {
  const [channel, setChannel] = useState<PitchChannel>("phone");
  const [pitch, setPitch] = useState<GeneratedPitch | undefined>(initialPitch);
  const [content, setContent] = useState(initialPitch?.content || "");
  const [loading, setLoading] = useState(false);
  const [error,setError] = useState("");
  const [saved, setSaved] = useState(false);

  async function generate() {
    setLoading(true);
    setSaved(false);
    setError("");
    try {
    const response = await fetch("/api/agent/generate-pitch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leadId, channel })
    });
    const nextPitch = await awaitBackgroundResult<GeneratedPitch>(response);
    setPitch(nextPitch);
    setContent(nextPitch.content);
    } catch(error) { setError(error instanceof Error?error.message:"生成失败"); }
    finally { setLoading(false); }
  }

  async function savePitch() {
    if (!pitch || !content.trim()) return;
    const response = await fetch(`/api/pitches/${pitch.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content }) });
    if (response.ok) setPitch(await response.json());
  }

  async function saveFollowUp() {
    if (!pitch) return;
    await fetch("/api/follow-ups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        leadId,
        pitchId: pitch.id,
        type: channel === "email" ? "email" : channel === "wechat" ? "wechat" : "call",
        content: pitch.content
      })
    });
    setSaved(true);
  }

  return (
    <div className="panel">
      <h2>专业销售话术</h2>
      {error && <p role="alert">{error}</p>}
      {loading && <p>后台任务已提交，可关闭页面并在<a href="/tasks">任务中心</a>查看结果。</p>}
      <div className="actions">
        <select value={channel} onChange={(event) => setChannel(event.target.value as PitchChannel)}>
          {channelOptions.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
        <button className="button" onClick={generate} disabled={loading}>
          <MessageSquareText size={17} />
          {loading ? "生成中" : "生成话术"}
        </button>
        <button className="button secondary" onClick={saveFollowUp} disabled={!pitch}>
          <Save size={17} />
          保存跟进
        </button>
        <button className="button secondary" onClick={savePitch} disabled={!pitch || !content.trim()}>保存话术</button>
      </div>

      {pitch ? (
        <div style={{ marginTop: 14 }}>
          <textarea className="pitch-box" value={content} onChange={(event) => setContent(event.target.value)} aria-label="编辑销售话术" />
          <p className="subtle" style={{ marginTop: 10 }}>
            {pitch.rationale}
          </p>
          <div className="badge-row">
            {pitch.citations.map((citation) => (
              <span className="badge" key={citation}>
                {citation}
              </span>
            ))}
          </div>
          {saved ? <p className="subtle" style={{ marginTop: 10 }}>已保存到跟进记录。</p> : null}
        </div>
      ) : (
        <p className="subtle" style={{ marginTop: 14 }}>
          选择销售场景后生成话术。内容会结合客户画像、产品资料和销售知识库。
        </p>
      )}
    </div>
  );
}
