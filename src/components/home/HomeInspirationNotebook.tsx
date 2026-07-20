"use client";

import { FormEvent, useEffect, useState } from "react";
import { CheckCircle2, PenLine, Plus, Trash2, X } from "lucide-react";

type Inspiration = {
  id: string;
  title: string;
  note: string;
  createdAt: string;
  completed: boolean;
};

const storageKey = "friction-x-home-inspirations";

export function HomeInspirationNotebook() {
  const [items, setItems] = useState<Inspiration[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) {
      setHydrated(true);
      return;
    }

    try {
      const parsed = JSON.parse(raw) as Partial<Inspiration>[];
      if (Array.isArray(parsed)) {
        setItems(parsed.filter((item) => item.id && item.title && item.createdAt).map((item) => ({
          id: item.id!,
          title: item.title!,
          note: item.note ?? "",
          createdAt: item.createdAt!,
          completed: item.completed ?? false
        })));
      }
    } catch {
      window.localStorage.removeItem(storageKey);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(storageKey, JSON.stringify(items));
  }, [hydrated, items]);

  function resetForm() {
    setTitle("");
    setNote("");
  }

  function closeModal() {
    setOpen(false);
    resetForm();
  }

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;

    setItems((current) => [
      {
        id: `${Date.now()}`,
        title: trimmedTitle,
        note: note.trim(),
        createdAt: new Date().toISOString(),
        completed: false
      },
      ...current
    ]);
    closeModal();
  }

  function toggleCompleted(id: string) {
    setItems((current) => current.map((item) => item.id === id ? { ...item, completed: !item.completed } : item));
  }

  function removeItem(id: string) {
    setItems((current) => current.filter((item) => item.id !== id));
  }

  return (
    <div className="inspiration-notebook">
      <div className="idea-entry">
        <PenLine size={15} />
        <span>灵感自述</span>
        <em>像记事本一样手动记录内容线索</em>
        <button type="button" onClick={() => setOpen(true)}><Plus size={13} />录入灵感</button>
      </div>

      {items.length ? <div className="inspiration-todolist" aria-label="灵感自述列表">
        {items.map((item) => <article key={item.id} className={`inspiration-task ${item.completed ? "completed" : ""}`}>
          <button className="inspiration-complete" type="button" onClick={() => toggleCompleted(item.id)} aria-label={item.completed ? "标记为未完成" : "标记为已完成"}><CheckCircle2 size={15} /></button>
          <div>
            <strong>{item.title}</strong>
            {item.note ? <p>{item.note}</p> : <small>未填写备注</small>}
          </div>
          <time>{new Date(item.createdAt).toLocaleDateString("zh-CN")}</time>
          <button className="inspiration-delete" type="button" onClick={() => removeItem(item.id)} aria-label={`删除${item.title}`}><Trash2 size={14} /></button>
        </article>)}
      </div> : <div className="inspiration-empty">暂无灵感，点击“录入灵感”添加第一条内容线索。</div>}

      {open ? <div className="inspiration-modal-overlay" role="dialog" aria-modal="true" aria-label="录入灵感">
        <form className="inspiration-modal" onSubmit={save}>
          <div className="inspiration-modal-head">
            <div><p className="eyebrow">灵感自述</p><h2>录入灵感</h2></div>
            <button type="button" onClick={closeModal} aria-label="关闭录入灵感"><X size={17} /></button>
          </div>
          <div className="form-grid">
            <div className="field full"><label>灵感标题</label><input value={title} onChange={(event) => setTitle(event.target.value)} required autoFocus placeholder="例如：客户现场提出的高频问题" /></div>
            <div className="field full"><label>备注</label><textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="可以记录来源、场景、适合做成的内容形式等" /></div>
          </div>
          <div className="inspiration-modal-actions">
            <button className="button secondary" type="button" onClick={closeModal}>取消</button>
            <button className="button" type="submit">保存</button>
          </div>
        </form>
      </div> : null}
    </div>
  );
}
