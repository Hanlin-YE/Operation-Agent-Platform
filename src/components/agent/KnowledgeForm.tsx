"use client";

import { FormEvent, useRef, useState } from "react";
import { Paperclip, Send, Settings2 } from "lucide-react";
import { KnowledgeDocument } from "@/server/data/types";
import { KnowledgeSettings } from "@/components/agent/KnowledgeSettings";
import styles from "@/components/agent/KnowledgeForm.module.css";

function inferTitle(content: string) {
  return content.trim().split(/\r?\n/).find(Boolean)?.replace(/^#+\s*/, "").slice(0, 42) || "未命名知识";
}

export function KnowledgeForm({ knowledge }: { knowledge: KnowledgeDocument[] }) {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!content.trim() && !selectedFile) return;
    setLoading(true); setMessage("");
    const response = selectedFile
      ? await fetch("/api/knowledge/upload", { method: "POST", body: (() => { const form = new FormData(); form.set("file", selectedFile); return form; })() })
      : await fetch("/api/knowledge", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: inferTitle(content), content, type: "faq" })
      });
    setLoading(false);
    const payload = await response.json().catch(() => ({})) as { error?: string; rag?: { chunks?: number; embeddingModel?: string } };
    if (!response.ok) {
      return setMessage(payload.error || "保存失败，请稍后重试。");
    }
    setContent(""); setSelectedFile(null);
    setMessage(selectedFile ? `PDF 已解析并收录：${payload.rag?.chunks || 0} 个向量块已由 ${payload.rag?.embeddingModel || "本地编码器"} 完成 Embedding。` : "已收录到知识库并完成向量索引。");
  }

  return <>
    <form className="knowledge-composer" onSubmit={onSubmit}>
      <div className="knowledge-composer-top">
        <div><span className="knowledge-composer-dot" /><span>企业知识库</span></div>
        <button className="knowledge-settings-trigger" type="button" onClick={() => setSettingsOpen(true)} aria-label="管理已建立的知识库" title="知识库设置"><Settings2 size={18} /></button>
      </div>
      <textarea value={content} onChange={(event) => setContent(event.target.value)} placeholder="把产品资料、选型经验、客户异议或案例粘贴在这里…" aria-label="输入要收录的知识" />
      <div className="knowledge-composer-footer">
        <input ref={fileInputRef} className={styles.fileInput} type="file" accept="application/pdf,.pdf" onChange={(event) => setSelectedFile(event.target.files?.[0] || null)} />
        <button className={styles.fileTrigger} type="button" onClick={() => fileInputRef.current?.click()}><Paperclip size={16} />{selectedFile ? selectedFile.name : "上传 PDF（最大 20 MB）"}</button>
        <div><span className="knowledge-auto-label">自动整理</span><button className="knowledge-send" disabled={loading || (!content.trim() && !selectedFile)} aria-label="收录到知识库"><Send size={19} />{loading ? "收录中" : "收录"}</button></div>
      </div>
      {message ? <p className="knowledge-composer-message">{message}</p> : null}
    </form>
    {settingsOpen ? <KnowledgeSettings knowledge={knowledge} onClose={() => setSettingsOpen(false)} /> : null}
  </>;
}
