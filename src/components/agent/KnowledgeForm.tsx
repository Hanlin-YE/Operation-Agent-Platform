"use client";

import { FormEvent, useState } from "react";
import { Plus } from "lucide-react";

export function KnowledgeForm() {
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    const form = event.currentTarget;
    const payload = Object.fromEntries(new FormData(form).entries());
    await fetch("/api/knowledge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    form.reset();
    window.location.reload();
  }

  return (
    <form className="panel" onSubmit={onSubmit}>
      <h2>新增销售知识</h2>
      <div className="form-grid">
        <div className="field">
          <label>标题</label>
          <input name="title" required placeholder="价格异议处理 SOP" />
        </div>
        <div className="field">
          <label>类型</label>
          <select name="type" defaultValue="faq">
            <option value="product">产品资料</option>
            <option value="case">行业案例</option>
            <option value="objection">异议处理</option>
            <option value="selection">选型资料</option>
            <option value="faq">FAQ</option>
          </select>
        </div>
        <div className="field full">
          <label>内容</label>
          <textarea name="content" required placeholder="粘贴产品手册、选型要点、成功案例或销售 SOP..." />
        </div>
      </div>
      <div className="actions" style={{ marginTop: 14 }}>
        <button className="button" disabled={loading}>
          <Plus size={17} />
          {loading ? "保存中" : "保存知识"}
        </button>
      </div>
    </form>
  );
}
