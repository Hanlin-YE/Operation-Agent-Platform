# 自超滑论文与专利 RAG 架构

更新时间：2026-07-15

## 决策

当前项目采用证据优先的自有 RAG：

```text
PDF / 文本资料
  -> Source Registry
  -> Docling + GROBID 解析边界
  -> page / section / claim aware chunks
  -> PostgreSQL + pgvector
  -> metadata filter + vector retrieval + rerank
  -> citation response
  -> Review Agent + 人工确认
  -> Neo4j 审核后关系投影
```

PostgreSQL 是文档、版本、审核和 Chunk 的权威数据源；Neo4j 不保存未经审核的事实，也不承担全文检索。

## 当前已落地

- `rag_source_documents`：论文、专利、产品资料和标准的来源台账。
- `rag_document_chunks`：保留页码、章节路径和权利要求编号的 Chunk。
- `rag_evidence`：证据原文、类型、置信度和审核状态。
- `vector(1024)`：为 BGE-M3 预留的向量字段。
- HNSW cosine 索引。
- 50 MB PDF 上传限制、PDF 文件头验证、SHA-256 去重依据和持久化卷。
- Review Gate：未批准文档不能被检索。
- 检索结果返回文档 ID、标题、类型、URL、页码、章节、权利要求编号和原文引用。
- 无模型环境下使用明确标识的 deterministic local embedding，便于开发测试。

## API

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| `GET` | `/api/rag/health` | 查看 Embedding 与解析器状态 |
| `POST` | `/api/rag/documents/text` | 导入已提取的分页文本 |
| `POST` | `/api/rag/documents/upload` | 注册并保存 PDF |
| `POST` | `/api/rag/documents/{id}/approve` | 人工批准文档进入检索范围 |
| `POST` | `/api/rag/search` | 带引用的语义检索 |

Next.js 通过 `/api/rag/[...path]` 将请求转发到 FastAPI。

## PDF 交付后的解析步骤

当前 PDF 会安全保存并标记：

```text
parse_status = pending
parser_target = docling+grobid
```

收到真实 PDF 后执行：

1. Docling 解析页面、段落、表格、图片和版面结构。
2. 论文通过 GROBID 补全 DOI、作者、机构、参考文献和章节。
3. 专利按摘要、背景、实施例、独立权利要求和从属权利要求切片。
4. 中文扫描件在解析失败时进入 OCR 分支，并记录 OCR 置信度。
5. 生成 BGE-M3 Embedding，写入 pgvector。
6. 人工审阅来源和切片后才转为 `approved`。

## Provider 边界

- `EmbeddingProvider`：当前为离线确定性实现，生产目标为 BGE-M3。
- `DocumentParser`：当前为 Docling/GROBID 契约边界，待真实 PDF 校准。
- `LlmProvider`：只消费已审核检索结果，不直接读取原始网页或未审核 PDF。
- Reranker：接口将在真实检索评测集建立后接入，目标为 BGE Reranker。

## 后续验收

- 同一 PDF 重复上传不会生成多份权威 Source。
- 未审核文档搜索结果为零。
- 论文回答必须携带页码和引用原文。
- 专利回答必须在可用时携带权利要求编号。
- 删除 Source 时级联删除 Chunk，但保留独立审计日志。
- Embedding 模型变更后通过版本字段执行重建索引，不混用向量版本。
