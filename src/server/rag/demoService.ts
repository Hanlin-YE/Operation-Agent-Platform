import { createHash } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import { extractPdfText } from "@/server/rag/pdfText";

export type DemoDocumentType = "paper" | "patent" | "product" | "standard";
type DemoReviewStatus = "pending" | "approved" | "rejected";

type DemoRagDocument = {
  id: string;
  title: string;
  document_type: DemoDocumentType;
  source_url: string | null;
  storage_path: string | null;
  checksum: string;
  metadata: Record<string, unknown>;
  review_status: DemoReviewStatus;
  reviewer_id: string | null;
  reviewed_at: string | null;
  created_at: string;
  text_content: string | null;
};

type DemoRagStore = {
  documents: DemoRagDocument[];
};

type SearchHit = {
  chunk_id: string;
  text: string;
  score: number;
  citation: {
    document_id: string;
    title: string;
    document_type: DemoDocumentType;
    source_url: string | null;
    page_number: number;
    section_path: string | null;
    claim_number: string | null;
    quote: string;
  };
};

const dataFile = path.join(process.cwd(), "data", "rag-demo-data.json");
const storageDirectory = path.join(process.cwd(), "data", "rag-demo-files");
const memoryStoreKey = "__RAG_DEMO_STORE__";

type GlobalStore = typeof globalThis & {
  [memoryStoreKey]?: DemoRagStore;
};

function createEmptyStore(): DemoRagStore {
  return { documents: [] };
}

function shouldUseMemoryStore() {
  return process.env.CLOUDFLARE === "true" || process.env.DEMO_EPHEMERAL_STORE === "true";
}

function getMemoryStore() {
  const storeHost = globalThis as GlobalStore;
  if (!storeHost[memoryStoreKey]) {
    storeHost[memoryStoreKey] = createEmptyStore();
  }
  return storeHost[memoryStoreKey];
}

async function ensureStore() {
  await fs.mkdir(path.dirname(dataFile), { recursive: true });
  try {
    await fs.access(dataFile);
  } catch {
    await fs.writeFile(dataFile, JSON.stringify(createEmptyStore(), null, 2), "utf8");
  }
}

async function readStore() {
  if (shouldUseMemoryStore()) {
    return structuredClone(getMemoryStore()) as DemoRagStore;
  }

  await ensureStore();
  const raw = await fs.readFile(dataFile, "utf8");
  return JSON.parse(raw) as DemoRagStore;
}

async function writeStore(store: DemoRagStore) {
  if (shouldUseMemoryStore()) {
    const storeHost = globalThis as GlobalStore;
    storeHost[memoryStoreKey] = structuredClone(store) as DemoRagStore;
    return;
  }

  await ensureStore();
  await fs.writeFile(dataFile, JSON.stringify(store, null, 2), "utf8");
}

function makeId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function cleanTitle(value: string) {
  return value.trim().replaceAll("_", " ").replace(/\s+/g, " ").replace(/^[._ -]+|[._ -]+$/g, "");
}

function inferTitleFromFilename(filename: string) {
  const stem = filename.replace(/\.pdf$/i, "");
  const withoutSequence = stem.replace(/^\d{1,4}[-_. ]+(?:19|20)\d{2}[-_. ]+/, "");
  const withoutYear = withoutSequence.replace(/^(?:19|20)\d{2}[-_. ]+/, "");
  return cleanTitle(withoutYear) || "未命名 PDF";
}

function sha256(content: Uint8Array) {
  return createHash("sha256").update(content).digest("hex");
}

function tokenize(text: string) {
  return text
    .toLowerCase()
    .split(/[\s,.;:!?，。；：！？、()（）\[\]{}"'`<>\/\\|+-]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);
}

/** 是否为 CJK 字符（中日韩统一表意文字、假名、谚文） */
function isCJK(c: string): boolean {
  const code = c.charCodeAt(0);
  return (
    (code >= 0x4e00 && code <= 0x9fff) || // CJK unified
    (code >= 0x3400 && code <= 0x4dbf) || // CJK extension A
    (code >= 0x3040 && code <= 0x309f) || // Hiragana
    (code >= 0x30a0 && code <= 0x30ff) || // Katakana
    (code >= 0xac00 && code <= 0xd7af)    // Hangul
  );
}

/** 对含 CJK 字符的长 token 做 2-gram / 3-gram 切分，提升中文检索召回 */
function enrichCJKTokens(baseTokens: string[]): string[] {
  const result: string[] = [];
  for (const token of baseTokens) {
    result.push(token);
    if (token.length >= 4 && [...token].some(isCJK)) {
      for (let i = 0; i <= token.length - 2; i++) {
        result.push(token.slice(i, i + 2));
      }
      if (token.length >= 5) {
        for (let i = 0; i <= token.length - 3; i++) {
          result.push(token.slice(i, i + 3));
        }
      }
    }
  }
  return [...new Set(result)];
}

function pageChunks(document: DemoRagDocument) {
  const pages = (document.text_content || "").split("\f").map((page) => page.trim()).filter(Boolean);
  return pages.map((page, index) => ({ page, pageNumber: index + 1 }));
}

export async function getDemoRagHealth() {
  return {
    status: "ready_for_ingest",
    embedding_model: "deterministic_local",
    embedding_dimensions: 1024,
    parser: "deferred_demo_parser",
    parser_status: "demo_mode_without_agent_root",
  };
}

export async function uploadDemoBatch(args: {
  documentType: DemoDocumentType;
  sourceUrl?: string | null;
  metadata?: Record<string, unknown>;
  files: File[];
}) {
  const store = await readStore();
  const documents: DemoRagDocument[] = [];
  const failures: { filename: string; message: string }[] = [];

  const persistentStorage = !shouldUseMemoryStore();
  if (persistentStorage) {
    await fs.mkdir(storageDirectory, { recursive: true });
  }

  for (const file of args.files) {
    const filename = file.name || "document.pdf";
    if (!/\.pdf$/i.test(filename)) {
      failures.push({ filename, message: "only PDF uploads are accepted" });
      continue;
    }

    const content = new Uint8Array(await file.arrayBuffer());
    if (!content.length || !(String.fromCharCode(...content.slice(0, 5)) === "%PDF-")) {
      failures.push({ filename, message: "invalid PDF file" });
      continue;
    }

    let extracted;
    try {
      extracted = await extractPdfText(Buffer.from(content));
    } catch (error) {
      failures.push({ filename, message: error instanceof Error ? error.message : "PDF 解析失败" });
      continue;
    }

    const checksum = sha256(content);
    const storedFilename = `${checksum}.pdf`;
    const storagePath = persistentStorage ? path.join(storageDirectory, storedFilename) : null;
    if (storagePath) {
      await fs.writeFile(storagePath, content);
    }

    const document: DemoRagDocument = {
      id: makeId("doc"),
      title: inferTitleFromFilename(filename),
      document_type: args.documentType,
      source_url: args.sourceUrl || null,
      storage_path: storagePath,
      checksum,
      metadata: {
        ...(args.metadata || {}),
        original_filename: filename,
        title_source: "filename",
        parse_status: "completed",
        parser_target: "pdf-parse",
        page_count: extracted.pageCount,
      },
      review_status: "pending",
      reviewer_id: null,
      reviewed_at: null,
      created_at: new Date().toISOString(),
      text_content: extracted.text,
    };

    store.documents.unshift(document);
    documents.push(document);
  }

  await writeStore(store);

  return {
    created_count: documents.length,
    failed_count: failures.length,
    documents,
    failures,
  };
}

export async function ingestDemoText(args: {
  title: string;
  documentType: DemoDocumentType;
  text: string;
  sourceUrl?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const store = await readStore();
  const document: DemoRagDocument = {
    id: makeId("doc"),
    title: cleanTitle(args.title) || "未命名资料",
    document_type: args.documentType,
    source_url: args.sourceUrl || null,
    storage_path: null,
    checksum: sha256(Buffer.from(args.text, "utf8")),
    metadata: {
      ...(args.metadata || {}),
      parse_status: "completed",
      parser_target: "inline_text",
    },
    review_status: "pending",
    reviewer_id: null,
    reviewed_at: null,
    created_at: new Date().toISOString(),
    text_content: args.text,
  };
  store.documents.unshift(document);
  await writeStore(store);
  return document;
}

export async function approveDemoDocument(documentId: string, reviewerId: string) {
  const store = await readStore();
  const document = store.documents.find((item) => item.id === documentId);
  if (!document) {
    throw new Error("document_not_found");
  }

  document.review_status = "approved";
  document.reviewer_id = reviewerId;
  document.reviewed_at = new Date().toISOString();
  await writeStore(store);
  return document;
}

export async function searchDemoRag(query: string, limit = 8, documentType?: DemoDocumentType) {
  const store = await readStore();
  const queryTokens = enrichCJKTokens(tokenize(query));
  if (!queryTokens.length) {
    return [] as SearchHit[];
  }

  const hits = store.documents
    .filter((document) => document.review_status === "approved")
    .filter((document) => !documentType || document.document_type === documentType)
    .flatMap((document) =>
      pageChunks(document).map(({ page, pageNumber }) => {
        const pageText = page.toLowerCase();
        const score = queryTokens.reduce((sum, token) => sum + (pageText.includes(token) ? 1 : 0), 0) / queryTokens.length;
        return { document, page, pageNumber, score };
      })
    )
    .filter((hit) => hit.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, limit)
    .map((hit) => ({
      chunk_id: makeId("chk"),
      text: hit.page,
      score: Number(hit.score.toFixed(4)),
      citation: {
        document_id: hit.document.id,
        title: hit.document.title,
        document_type: hit.document.document_type,
        source_url: hit.document.source_url,
        page_number: hit.pageNumber,
        section_path: null,
        claim_number: null,
        quote: hit.page.length > 240 ? `${hit.page.slice(0, 237)}...` : hit.page,
      },
    }));

  return hits;
}
