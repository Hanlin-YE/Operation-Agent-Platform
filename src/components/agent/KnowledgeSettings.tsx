"use client";

import { FormEvent, useState } from "react";
import { Check, Pencil, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { KnowledgeDocument } from "@/server/data/types";

const types: { value: KnowledgeDocument["type"]; label: string }[] = [
  { value: "product", label: "产品资料" }, { value: "case", label: "行业案例" }, { value: "objection", label: "异议处理" }, { value: "selection", label: "选型资料" }, { value: "faq", label: "FAQ" }
];

export function KnowledgeSettings({ knowledge, onClose }: { knowledge: KnowledgeDocument[]; onClose: () => void }) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function save(event: FormEvent<HTMLFormElement>, id: string) {
    event.preventDefault(); setBusy(id);
    const payload = Object.fromEntries(new FormData(event.currentTarget).entries());
    const response = await fetch("/api/knowledge", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...payload, id }) });
    setBusy(null);
    if (response.ok) { setEditing(null); router.refresh(); }
  }

  async function remove(id: string, title: string) {
    if (!window.confirm(`确认删除“${title}”吗？此操作无法撤销。`)) return;
    setBusy(id);
    const response = await fetch(`/api/knowledge?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    setBusy(null);
    if (response.ok) router.refresh();
  }

  return <div className="knowledge-settings-overlay" role="dialog" aria-modal="true" aria-label="知识库设置"><section className="knowledge-settings-dialog"><div className="knowledge-settings-head"><div><p className="eyebrow">Knowledge Settings</p><h2>已建立的知识库</h2><p className="subtle">在这里编辑或删除已收录的内容。</p></div><button className="knowledge-settings-trigger" type="button" onClick={onClose} aria-label="关闭知识库设置"><X size={18} /></button></div><div className="knowledge-settings-list">{knowledge.map((item) => editing === item.id ? <form className="knowledge-settings-item editing" key={item.id} onSubmit={(event) => save(event, item.id)}><div className="form-grid"><div className="field"><label>标题</label><input name="title" required defaultValue={item.title} /></div><div className="field"><label>类型</label><select name="type" defaultValue={item.type}>{types.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}</select></div><div className="field full"><label>内容</label><textarea name="content" required defaultValue={item.content} /></div></div><div className="actions" style={{ marginTop: 12 }}><button className="button" disabled={busy === item.id}><Check size={16} />{busy === item.id ? "保存中" : "保存修改"}</button><button className="button secondary" type="button" onClick={() => setEditing(null)}>取消</button></div></form> : <article className="knowledge-settings-item" key={item.id}><div><span className="badge">{item.type}</span><h3>{item.title}</h3><p className="subtle">{item.content}</p></div><div className="knowledge-settings-actions"><button className="button secondary" type="button" onClick={() => setEditing(item.id)}><Pencil size={15} />编辑</button><button className="button secondary" type="button" disabled={busy === item.id} onClick={() => remove(item.id, item.title)}><Trash2 size={15} />删除</button></div></article>)}</div></section></div>;
}
