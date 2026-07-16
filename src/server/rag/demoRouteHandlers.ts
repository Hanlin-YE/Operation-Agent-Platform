import { NextResponse } from "next/server";
import {
  approveDemoDocument,
  DemoDocumentType,
  getDemoRagHealth,
  ingestDemoText,
  searchDemoRag,
  uploadDemoBatch,
} from "@/server/rag/demoService";

const documentTypes = new Set<DemoDocumentType>(["paper", "patent", "product", "standard"]);

function asDocumentType(value: string | null | undefined): DemoDocumentType {
  if (value && documentTypes.has(value as DemoDocumentType)) {
    return value as DemoDocumentType;
  }
  return "paper";
}

function asObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function isUploadedFile(value: FormDataEntryValue): value is File {
  return typeof value === "object" && value !== null && "arrayBuffer" in value && "name" in value;
}

export async function handleDemoRagGet(path: string[]) {
  if (path.length === 1 && path[0] === "health") {
    return NextResponse.json(await getDemoRagHealth());
  }

  return NextResponse.json({ message: "Not found" }, { status: 404 });
}

export async function handleDemoRagPost(request: Request, path: string[]) {
  if (path.length === 3 && path[0] === "documents" && path[1] === "upload" && path[2] === "batch") {
    const formData = await request.formData();
    const files = formData.getAll("files").filter(isUploadedFile);
    if (!files.length || files.length > 20) {
      return NextResponse.json({ detail: "upload between 1 and 20 PDF files" }, { status: 422 });
    }
    const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
    if (files.some((file) => file.size > 20 * 1024 * 1024) || totalBytes > 100 * 1024 * 1024) {
      return NextResponse.json({ detail: "each PDF must be at most 20 MB; batch total must be at most 100 MB" }, { status: 413 });
    }

    const metadataRaw = formData.get("metadata_json");
    let metadata: Record<string, unknown> = {};
    if (typeof metadataRaw === "string" && metadataRaw.trim()) {
      try {
        metadata = asObject(JSON.parse(metadataRaw));
      } catch {
        return NextResponse.json({ detail: "metadata_json must be a JSON object" }, { status: 422 });
      }
    }

    const payload = await uploadDemoBatch({
      documentType: asDocumentType(formData.get("document_type")?.toString()),
      sourceUrl: formData.get("source_url")?.toString() || null,
      metadata,
      files,
    });
    return NextResponse.json(payload, { status: 201 });
  }

  if (path.length === 2 && path[0] === "documents" && path[1] === "text") {
    const body = (await request.json()) as Record<string, unknown>;
    if (typeof body.title !== "string" || !body.title.trim() || typeof body.text !== "string" || !body.text.trim()) {
      return NextResponse.json({ detail: "title and text are required" }, { status: 422 });
    }
    const document = await ingestDemoText({
      title: body.title,
      text: body.text,
      documentType: asDocumentType(typeof body.document_type === "string" ? body.document_type : undefined),
      sourceUrl: typeof body.source_url === "string" ? body.source_url : null,
      metadata: asObject(body.metadata),
    });
    return NextResponse.json(document, { status: 201 });
  }

  if (path.length === 3 && path[0] === "documents" && path[2] === "approve") {
    const body = (await request.json()) as Record<string, unknown>;
    if (typeof body.reviewer_id !== "string" || !body.reviewer_id.trim()) {
      return NextResponse.json({ detail: "reviewer_id is required" }, { status: 422 });
    }
    try {
      const document = await approveDemoDocument(path[1], body.reviewer_id);
      return NextResponse.json(document);
    } catch {
      return NextResponse.json({ detail: "document not found" }, { status: 404 });
    }
  }

  if (path.length === 1 && path[0] === "search") {
    const body = (await request.json()) as Record<string, unknown>;
    if (typeof body.query !== "string" || !body.query.trim()) {
      return NextResponse.json({ detail: "query is required" }, { status: 422 });
    }
    const limit = typeof body.limit === "number" && Number.isFinite(body.limit) ? Math.max(1, Math.min(50, body.limit)) : 8;
    const hits = await searchDemoRag(body.query, limit, typeof body.document_type === "string" ? asDocumentType(body.document_type) : undefined);
    return NextResponse.json(hits);
  }

  return NextResponse.json({ message: "Not found" }, { status: 404 });
}
