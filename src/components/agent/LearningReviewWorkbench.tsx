"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { MessageCirclePlus, Send } from "lucide-react";
import { LearningCategory, LearningConversation } from "@/server/data/types";

const directions: { value: LearningCategory; label: string; description: string }[] = [
  { value: "product", label: "产品学习", description: "围绕产品资料、参数、案例进行复习" },
  { value: "market", label: "市场培训", description: "围绕市场判断、客户场景和竞争信息训练" },
  { value: "script", label: "营销话术", description: "围绕沟通开场、异议处理和跟进表达练习" }
];

function getCategory(item: LearningConversation): LearningCategory {
  return item.category ?? "product";
}

export function LearningReviewWorkbench() {
  const [items, setItems] = useState<LearningConversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [category, setCategory] = useState<LearningCategory>("product");
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);

  const filteredItems = useMemo(() => items.filter((item) => getCategory(item) === category), [category, items]);
  const active = filteredItems.find((item) => item.id === activeId) ?? filteredItems[0];
  const activeDirection = directions.find((item) => item.value === category) ?? directions[0];

  useEffect(() => {
    fetch("/api/learning-conversations")
      .then((response) => response.json())
      .then((data: LearningConversation[]) => {
        setItems(data);
        setActiveId(data.find((item) => getCategory(item) === "product")?.id || null);
      });
  }, []);

  useEffect(() => {
    setActiveId((current) => filteredItems.some((item) => item.id === current) ? current : filteredItems[0]?.id || null);
  }, [filteredItems]);

  async function create() {
    const response = await fetch("/api/learning-conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category })
    });
    const next = await response.json();
    setItems((current) => [next, ...current]);
    setActiveId(next.id);
  }

  async function send(event: FormEvent) {
    event.preventDefault();
    if (!active || !text.trim()) return;
    setLoading(true);
    const response = await fetch(`/api/learning-conversations/${active.id}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: text })
    });
    const next = await response.json();
    setText("");
    setLoading(false);
    if (response.ok) setItems((current) => [next, ...current.filter((item) => item.id !== next.id)]);
  }

  return <div className="learning-workbench"><aside className="learning-history"><div className="learning-history-head"><button className="button" onClick={create}><MessageCirclePlus size={16} />新对话</button><p>学习记录</p></div><div className="learning-history-tabs">{directions.map((item) => <button key={item.value} className={item.value === category ? "active" : ""} onClick={() => setCategory(item.value)} type="button">{item.label}</button>)}</div><div className="learning-records">{filteredItems.length ? filteredItems.map((item) => <button key={item.id} className={item.id === active?.id ? "active" : ""} onClick={() => setActiveId(item.id)} type="button"><span>{directions.find((direction) => direction.value === getCategory(item))?.label}</span><strong>{item.title}</strong><small>{item.messages.at(-1)?.content || "还没有提问"}</small></button>) : <div className="learning-history-empty">当前方向还没有学习记录。</div>}</div></aside><section className="learning-chat"><div className="learning-chat-head"><div><p className="eyebrow">Sales Training</p><h2>{active?.title || activeDirection.label}</h2><span>{activeDirection.description}</span></div></div><div className="learning-direction-row" aria-label="选择培训方向">{directions.map((item) => <button key={item.value} className={item.value === category ? "active" : ""} onClick={() => setCategory(item.value)} type="button"><strong>{item.label}</strong><small>{item.description}</small></button>)}</div>{active?.messages.length ? <div className="learning-messages">{active.messages.map((message) => <article className={message.role} key={message.id}><strong>{message.role === "learner" ? "我" : "学习助手"}</strong><p>{message.content}</p></article>)}</div> : <div className="learning-empty"><strong>从{activeDirection.label}开始</strong><p>选择方向后新建对话，输入你的问题或训练目标。</p></div>}<form className="learning-input" onSubmit={send}><textarea value={text} onChange={(event) => setText(event.target.value)} placeholder={`输入${activeDirection.label}相关问题…`} disabled={!active || loading} /><button className="button" disabled={!active || loading || !text.trim()}><Send size={16} />发送</button></form></section></div>;
}
