"use client";
import { FormEvent, useState } from "react";
import { Send } from "lucide-react";
type Message = { role: "客户" | "客服"; text: string };
export function CustomerServiceSimulator({ leadId, tier }: { leadId: string; tier: string }) {
  const [messages, setMessages] = useState<Message[]>([]); const [text, setText] = useState(""); const [loading, setLoading] = useState(false);
  async function send(event: FormEvent) { event.preventDefault(); if (!text.trim()) return; const customer = text; setMessages((items) => [...items, { role: "客户", text: customer }]); setText(""); setLoading(true); const response = await fetch("/api/agent/customer-service", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ leadId, message: customer }) }); const data = await response.json(); setMessages((items) => [...items, { role: "客服", text: `${data.reply}（策略：${data.strategy?.label || "受控回复"}）` }]); setLoading(false); }
  return <div className="panel"><h2>智能客服模拟器</h2><p className="subtle">账户层级：{tier}</p><div className="pitch-box">{messages.length ? messages.map((item, index) => <p key={index}><strong>{item.role}：</strong>{item.text}</p>) : "输入客户问题，验证分层与策略。"}</div><form className="actions" style={{ marginTop: 10 }} onSubmit={send}><input value={text} onChange={(event) => setText(event.target.value)} placeholder="例如：空心杯电机适合什么应用？" /><button className="button" disabled={loading}><Send size={16} />发送</button></form></div>;
}
