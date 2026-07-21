"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { MessageCirclePlus, MoreVertical, Pencil, Send, Trash2 } from "lucide-react";
import { LearningCategory, LearningConversation } from "@/server/data/types";
import { MarkdownMessage } from "@/components/agent/MarkdownMessage";

const directions: { value: LearningCategory; label: string; description: string }[] = [
  { value: "product", label: "产品学习", description: "围绕产品资料、参数、案例进行复习" },
  { value: "market", label: "市场培训", description: "输入目标企业名称，围绕企业画像训练市场判断" },
  { value: "script", label: "营销话术", description: "温柔陪练开场、提问、异议处理和成交推进" }
];

function getCategory(item: LearningConversation): LearningCategory {
  return item.category ?? "product";
}

export function LearningReviewWorkbench() {
  const [items, setItems] = useState<LearningConversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [category, setCategory] = useState<LearningCategory>("product");
  const [text, setText] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [menuId, setMenuId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [creatingCategory, setCreatingCategory] = useState<LearningCategory | null>(null);

  const filteredItems = useMemo(() => items.filter((item) => getCategory(item) === category), [category, items]);
  const active = filteredItems.find((item) => item.id === activeId) ?? filteredItems[0];
  const activeDirection = directions.find((item) => item.value === category) ?? directions[0];

  const create = useCallback(async (targetCategory: LearningCategory = category) => {
    if (creatingCategory) return null;
    setCreatingCategory(targetCategory);
    const response = await fetch("/api/learning-conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category: targetCategory })
    });
    const next = await response.json();
    setItems((current) => [next, ...current]);
    setActiveId(next.id);
    setCreatingCategory(null);
    return next as LearningConversation;
  }, [category, creatingCategory]);

  useEffect(() => {
    fetch("/api/learning-conversations")
      .then((response) => response.json())
      .then((data: LearningConversation[]) => {
        setItems(data);
        const firstProduct = data.find((item) => getCategory(item) === "product");
        if (firstProduct) {
          setActiveId(firstProduct.id);
          return;
        }
        void create("product");
      });
  }, [create]);

  useEffect(() => {
    setActiveId((current) => filteredItems.some((item) => item.id === current) ? current : filteredItems[0]?.id || null);
  }, [filteredItems]);

  async function selectCategory(nextCategory: LearningCategory) {
    setCategory(nextCategory);
    setEditingId(null);
    setMenuId(null);
    const first = items.find((item) => getCategory(item) === nextCategory);
    if (first) {
      setActiveId(first.id);
      return;
    }
    await create(nextCategory);
  }

  async function rename(item: LearningConversation) {
    if (!editingTitle.trim()) return;
    const response = await fetch(`/api/learning-conversations/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: editingTitle })
    });
    const next = await response.json();
    if (response.ok) setItems((current) => current.map((record) => record.id === next.id ? next : record));
    setEditingId(null);
    setEditingTitle("");
  }

  async function remove(item: LearningConversation) {
    const response = await fetch(`/api/learning-conversations/${item.id}`, { method: "DELETE" });
    if (!response.ok) return;
    setItems((current) => current.filter((record) => record.id !== item.id));
    if (activeId === item.id) setActiveId(null);
    setMenuId(null);
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

  return <div className="learning-workbench"><aside className="learning-history"><div className="learning-history-head"><button className="button" onClick={() => create(category)} disabled={!!creatingCategory}><MessageCirclePlus size={16} />新对话</button><p>学习记录</p></div><div className="learning-history-tabs">{directions.map((item) => <button key={item.value} className={item.value === category ? "active" : ""} onClick={() => selectCategory(item.value)} type="button">{item.label}</button>)}</div><div className="learning-records">{filteredItems.length ? filteredItems.map((item) => <article key={item.id} className={`learning-record-card ${item.id === active?.id ? "active" : ""}`}>{editingId === item.id ? <div className="learning-record-rename"><input value={editingTitle} onChange={(event) => setEditingTitle(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void rename(item); if (event.key === "Escape") setEditingId(null); }} autoFocus maxLength={40} /><div><button type="button" onClick={() => rename(item)}>保存</button><button type="button" onClick={() => setEditingId(null)}>取消</button></div></div> : <><button className="learning-record-main" onClick={() => setActiveId(item.id)} type="button"><strong>{item.title}</strong></button><div className="learning-record-actions"><button className="learning-record-menu-trigger" type="button" onClick={() => setMenuId((current) => current === item.id ? null : item.id)} aria-label={`${item.title}更多操作`}><MoreVertical size={16} /></button>{menuId === item.id ? <div className="learning-record-menu"><button type="button" onClick={() => { setEditingId(item.id); setEditingTitle(item.title); setMenuId(null); }}><Pencil size={16} />重命名</button><button className="danger" type="button" onClick={() => remove(item)}><Trash2 size={16} />删除</button></div> : null}</div></>}</article>) : <div className="learning-history-empty">当前方向暂无学习记录。</div>}</div></aside><section className="learning-chat"><div className="learning-chat-head"><div><p className="eyebrow">Sales Training</p><h2>{active?.title || activeDirection.label}</h2><span>{activeDirection.description}</span></div></div><div className="learning-direction-row" aria-label="选择培训方向">{directions.map((item) => <button key={item.value} className={item.value === category ? "active" : ""} onClick={() => selectCategory(item.value)} type="button"><strong>{item.label}</strong><small>{item.description}</small></button>)}</div>{active?.messages.length ? <div className="learning-messages">{active.messages.map((message) => <article className={message.role} key={message.id}><strong>{message.role === "learner" ? "我" : "学习助手"}</strong>{message.role === "coach" ? <MarkdownMessage content={message.content} /> : <p>{message.content}</p>}</article>)}</div> : <div className="learning-empty"><strong>从{activeDirection.label}开始</strong><p>知识库不会直接展示；请输入问题或训练目标后，助手会基于内部资料生成训练回答。市场培训可直接输入目标企业名称，例如“山东山博电机集团有限公司”。</p></div>}<form className="learning-input" onSubmit={send}><textarea value={text} onChange={(event) => setText(event.target.value)} placeholder={category === "market" ? "输入目标企业名称或市场培训问题，例如：山东山博电机集团有限公司" : category === "script" ? "输入你的客户场景或原始话术，我来帮你温柔打磨…" : `输入${activeDirection.label}相关问题…`} disabled={!active || loading} /><button className="button" disabled={!active || loading || !text.trim()}><Send size={16} />发送</button></form></section></div>;
}
