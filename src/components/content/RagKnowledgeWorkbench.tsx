"use client";

import { FileSearch, FileUp, LoaderCircle, Search, ShieldCheck } from "lucide-react";
import { ChangeEvent, FormEvent, useEffect, useState } from "react";

type RagHealth = { status: string; embedding_model: string; embedding_dimensions: number; parser: string; parser_status: string };
type UploadedDocument = { id: string; title: string; document_type: string; review_status: string; metadata: { parse_status?: string; parser_target?: string } };
type BatchUploadResult = { created_count: number; failed_count: number; documents: UploadedDocument[]; failures: { filename: string; message: string }[] };
type SearchHit = { chunk_id: string; text: string; score: number; citation: { title: string; document_type: string; page_number: number; claim_number?: string | null; quote: string; source_url?: string | null } };

async function readJson(response: Response) {
  const body = await response.text();
  try { return JSON.parse(body); } catch { return { detail: "服务返回了无法识别的数据。" }; }
}

export function RagKnowledgeWorkbench() {
  const [health, setHealth] = useState<RagHealth | null>(null);
  const [uploading, setUploading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadResult, setUploadResult] = useState<BatchUploadResult | null>(null);
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/rag/health", { cache: "no-store" })
      .then(async (response) => {
        const payload = await readJson(response);
        if (!response.ok) throw new Error(payload.detail || payload.message || "RAG 服务未就绪");
        setHealth(payload);
      })
      .catch((reason: Error) => setError(reason.message));
  }, []);

  function previewTitle(filename: string) {
    return filename.replace(/\.pdf$/i, "").replace(/^\d{1,4}[-_. ]+(?:19|20)\d{2}[-_. ]+/, "").replace(/^(?:19|20)\d{2}[-_. ]+/, "").replaceAll("_", " ").trim();
  }

  function selectFiles(event: ChangeEvent<HTMLInputElement>) {
    setSelectedFiles(Array.from(event.target.files || []).slice(0, 20));
    setUploadResult(null);
    setError("");
  }

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    if (!selectedFiles.length) return;
    setUploading(true); setError(""); setUploadResult(null);
    try {
      const form = new FormData(formElement);
      form.set("metadata_json", JSON.stringify({ source_scope: "content_operations", ingestion_channel: "web_upload" }));
      const response = await fetch("/api/rag/documents/upload/batch", { method: "POST", body: form });
      const payload = await readJson(response);
      if (!response.ok) throw new Error(payload.detail || payload.message || "PDF 登记失败");
      setUploadResult(payload);
      setSelectedFiles([]);
      formElement.reset();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "PDF 登记失败");
    } finally { setUploading(false); }
  }

  async function searchEvidence(event: FormEvent) {
    event.preventDefault();
    if (!query.trim()) return;
    setSearching(true); setError("");
    try {
      const response = await fetch("/api/rag/search", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ query, limit: 8 }) });
      const payload = await readJson(response);
      if (!response.ok) throw new Error(payload.detail || payload.message || "检索失败");
      setHits(payload);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "检索失败");
    } finally { setSearching(false); }
  }

  return (
    <div className="rag-workbench">
      <section className="panel rag-ingest-panel">
        <div className="rag-section-head"><div><p className="eyebrow">Source Registry</p><h2>登记论文与专利 PDF</h2></div><FileUp size={19} /></div>
        <p className="subtle">一次最多选择 20 份 PDF。系统优先读取 PDF 元数据标题，缺失时从文件名自动识别。</p>
        <form className="rag-upload-form" onSubmit={upload}>
          <label className="field"><span>资料类型</span><select name="document_type" defaultValue="paper"><option value="paper">论文</option><option value="patent">专利</option><option value="standard">标准</option><option value="product">产品资料</option></select></label>
          <label className="field rag-file-field"><span>PDF 文件</span><input name="files" type="file" accept="application/pdf,.pdf" multiple required onChange={selectFiles} /></label>
          {selectedFiles.length ? <div className="rag-file-queue"><div className="rag-file-queue-head"><strong>待登记文件</strong><span>{selectedFiles.length} / 20</span></div>{selectedFiles.map((file) => <div className="rag-file-row" key={`${file.name}-${file.lastModified}`}><FileSearch size={15} /><span><strong>{previewTitle(file.name)}</strong><small>{file.name} · {(file.size / 1024 / 1024).toFixed(2)} MB</small></span><em>标题待识别</em></div>)}</div> : <div className="rag-file-empty">可按住 Shift 或 Command 一次选择多份 PDF</div>}
          <button className="button" disabled={uploading || !selectedFiles.length}>{uploading ? <LoaderCircle className="spin" size={16} /> : <FileUp size={16} />}{uploading ? `正在登记 ${selectedFiles.length} 份…` : `批量登记${selectedFiles.length ? ` ${selectedFiles.length} 份` : ""}`}</button>
        </form>
        {uploadResult && <div className="rag-batch-result"><div className="rag-success"><ShieldCheck size={18} /><div><strong>已登记 {uploadResult.created_count} 份资料</strong><span>{uploadResult.failed_count ? `${uploadResult.failed_count} 份失败` : "全部文件已进入待解析队列"}</span></div></div>{uploadResult.documents.map((document) => <div className="rag-uploaded-row" key={document.id}><strong>{document.title}</strong><span>{document.document_type} · {document.review_status}</span></div>)}{uploadResult.failures.map((failure) => <div className="rag-uploaded-row is-error" key={failure.filename}><strong>{failure.filename}</strong><span>{failure.message}</span></div>)}</div>}
      </section>

      <section className="panel rag-search-panel">
        <div className="rag-section-head"><div><p className="eyebrow">Evidence Retrieval</p><h2>检索已审核证据</h2></div><FileSearch size={19} /></div>
        <form className="rag-search-form" onSubmit={searchEvidence}><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索材料、摩擦机制、应用或权利要求" /><button className="button" disabled={searching}>{searching ? <LoaderCircle className="spin" size={16} /> : <Search size={16} />}检索</button></form>
        {hits.length ? <div className="rag-results">{hits.map((hit) => <article key={hit.chunk_id}><div><strong>{hit.citation.title}</strong><span>{hit.citation.document_type} · 第 {hit.citation.page_number} 页{hit.citation.claim_number ? ` · 权利要求 ${hit.citation.claim_number}` : ""}</span></div><p>{hit.citation.quote}</p><small>相关度 {(hit.score * 100).toFixed(1)}%</small></article>)}</div> : <div className="rag-empty">只有通过人工审核的 Chunk 才会出现在这里。</div>}
      </section>

      {error && <p className="run-error rag-error">{error}</p>}
      <section className="rag-runtime-strip" aria-label="RAG 运行状态">
        <div><span className={health ? "live-dot" : "status-dot"} /><strong>{health ? "RAG 接入层在线" : "正在连接 RAG 接入层"}</strong></div>
        <span>Embedding：{health?.embedding_model || "读取中"}</span><span>维度：{health?.embedding_dimensions || "—"}</span><span>解析器：{health?.parser || "读取中"}</span>
      </section>
    </div>
  );
}
