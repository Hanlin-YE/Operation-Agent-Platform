"use client";

import { FormEvent, useEffect, useState } from "react";
import { MessageCirclePlus, Send } from "lucide-react";
import { LearningConversation } from "@/server/data/types";

export function LearningReviewWorkbench() {
  const [items, setItems] = useState<LearningConversation[]>([]); const [activeId, setActiveId] = useState<string | null>(null); const [text, setText] = useState(""); const [loading, setLoading] = useState(false);
  const active = items.find((item) => item.id === activeId);
  useEffect(() => { fetch("/api/learning-conversations").then((response) => response.json()).then((data) => { setItems(data); setActiveId(data[0]?.id || null); }); }, []);
  async function create() { const response = await fetch("/api/learning-conversations", { method: "POST" }); const next = await response.json(); setItems((current) => [next, ...current]); setActiveId(next.id); }
  async function send(event: FormEvent) { event.preventDefault(); if (!active || !text.trim()) return; setLoading(true); const response = await fetch(`/api/learning-conversations/${active.id}/messages`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: text }) }); const next = await response.json(); setText(""); setLoading(false); if (response.ok) setItems((current) => [next, ...current.filter((item) => item.id !== next.id)]); }
  return <div className="learning-workbench"><aside className="learning-history"><button className="button" onClick={create}><MessageCirclePlus size={16} />新对话</button><p>复习记录</p><div>{items.length ? items.map((item) => <button key={item.id} className={item.id === activeId ? "active" : ""} onClick={() => setActiveId(item.id)}><strong>{item.title}</strong><span>{item.messages.at(-1)?.content || "还没有提问"}</span></button>) : <small>创建一段对话，开始销售知识复习。</small>}</div></aside><section className="learning-chat"><div className="learning-chat-head"><div><p className="eyebrow">Sales Learning</p><h2>{active?.title || "销售知识复习"}</h2></div><span>仅基于已收录知识回答</span></div>{active?.messages.length ? <div className="learning-messages">{active.messages.map((message) => <article className={message.role} key={message.id}><strong>{message.role === "learner" ? "我" : "学习助手"}</strong><p>{message.content}</p></article>)}</div> : <div className="learning-empty"><strong>从一个真实销售问题开始</strong><p>例如：客户认为价格高时，我应该先问什么？</p></div>}<form className="learning-input" onSubmit={send}><textarea value={text} onChange={(event) => setText(event.target.value)} placeholder="输入一个销售问题，开始复习…" disabled={!active || loading} /><button className="button" disabled={!active || loading || !text.trim()}><Send size={16} />发送</button></form></section></div>;
}
