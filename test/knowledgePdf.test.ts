import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import path from "node:path";
import { parseKnowledgePdfUpload } from "@/server/knowledge/pdfUpload";

test("parseKnowledgePdfUpload extracts PDF text and retains the original filename", async () => {
  const fixture = path.join(process.cwd(), "node_modules", "pdf-parse", "test", "data", "01-valid.pdf");
  const content = await readFile(fixture);
  const parsed = await parseKnowledgePdfUpload({
    name: "电机选型手册.pdf",
    type: "application/pdf",
    size: content.length,
    arrayBuffer: async () => content.buffer.slice(content.byteOffset, content.byteOffset + content.byteLength),
  });

  assert.equal(parsed.title, "电机选型手册");
  assert.equal(parsed.sourceFile, "电机选型手册.pdf");
  assert.ok(parsed.content.includes("JavaScript"));
});

test("parseKnowledgePdfUpload rejects non-PDF files", async () => {
  await assert.rejects(
    () => parseKnowledgePdfUpload({ name: "产品资料.txt", type: "text/plain", size: 5, arrayBuffer: async () => Buffer.from("hello").buffer }),
    /PDF/i
  );
});
