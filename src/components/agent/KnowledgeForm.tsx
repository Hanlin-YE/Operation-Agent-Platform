"use client";

import { FormEvent, useState } from "react";
import { Paperclip, Send, Settings2 } from "lucide-react";
import { KnowledgeDocument } from "@/server/data/types";
import { KnowledgeSettings } from "@/components/agent/KnowledgeSettings";

function inferTitle(content: string) {
  return content.trim().split(/\r?\n/).find(Boolean)?.replace(/^#+\s*/, "").slice(0, 42) || "未命名知识";
}

export function KnowledgeForm({ knowledge }: { knowledge: KnowledgeDocument[] }) {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [message, setMessage] = useState("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!content.trim()) return;
    setLoading(true); setMessage("");
    const response = await fetch("/api/knowledge", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: inferTitle(content), content, type: "faq" })
    });
    setLoading(false);
    if (!response.ok) return setMessage("保存失败，请稍后重试。");
    setContent(""); setMessage("已收录到知识库。");
    window.location.reload();
  }

  return <>
    <form className="knowledge-composer" onSubmit={onSubmit}>
      <div className="knowledge-composer-top">
        <div><span className="knowledge-composer-dot" /><span>企业知识库</span></div>
        <button className="knowledge-settings-trigger" type="button" onClick={() => setSettingsOpen(true)} aria-label="管理已建立的知识库" title="知识库设置"><Settings2 size={18} /></button>
      </div>
      <textarea value={content} onChange={(event) => setContent(event.target.value)} placeholder="把产品资料、选型经验、客户异议或案例粘贴在这里…" aria-label="输入要收录的知识" />
      <div className="knowledge-composer-footer">
        <span><Paperclip size={16} />支持粘贴文本，PDF 请使用资料登记</span>
        <div><span className="knowledge-auto-label">自动整理</span><button className="knowledge-send" disabled={loading || !content.trim()} aria-label="收录到知识库"><Send size={19} />{loading ? "收录中" : "收录"}</button></div>
      </div>
      {message ? <p className="knowledge-composer-message">{message}</p> : null}
    </form>
    {settingsOpen ? <KnowledgeSettings knowledge={knowledge} onClose={() => setSettingsOpen(false)} /> : null}
  </>;
}
