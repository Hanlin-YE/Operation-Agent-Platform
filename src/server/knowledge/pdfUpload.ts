import { extractPdfText } from "@/server/rag/pdfText";

const maxPdfSize = 20 * 1024 * 1024;

export type PdfUploadFile = {
  name: string;
  type: string;
  size: number;
  arrayBuffer(): Promise<ArrayBuffer>;
};

function titleFromFilename(filename: string) {
  return filename.replace(/\.pdf$/i, "").trim() || "未命名 PDF";
}

export async function parseKnowledgePdfUpload(file: PdfUploadFile) {
  if (!/\.pdf$/i.test(file.name) && file.type !== "application/pdf") {
    throw new Error("请上传 PDF 文件。");
  }
  if (!file.size) {
    throw new Error("PDF 文件为空。");
  }
  if (file.size > maxPdfSize) {
    throw new Error("PDF 文件不能超过 20 MB。");
  }

  const raw = Buffer.from(await file.arrayBuffer());
  if (raw.subarray(0, 5).toString("utf8") !== "%PDF-") {
    throw new Error("文件不是有效的 PDF。");
  }

  const extracted = await extractPdfText(raw);
  return {
    title: titleFromFilename(file.name),
    sourceFile: file.name,
    content: extracted.text,
    pageCount: extracted.pageCount,
  };
}
