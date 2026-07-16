import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import path from "node:path";
import { extractPdfText } from "../src/server/rag/pdfText";

test("extractPdfText keeps text and page boundaries from a readable PDF", async () => {
  const fixture = path.join(process.cwd(), "node_modules", "pdf-parse", "test", "data", "01-valid.pdf");
  const parsed = await extractPdfText(await readFile(fixture));

  assert.ok(parsed.text.length > 100);
  assert.ok(parsed.pages.length >= 1);
  assert.ok(parsed.text.includes("JavaScript"));
});

test("extractPdfText rejects a PDF with no extractable text", async () => {
  await assert.rejects(
    () => extractPdfText(Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n")),
    /无法读取|PDF/i
  );
});
