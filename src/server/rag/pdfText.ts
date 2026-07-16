type PdfPageData = {
  getTextContent(options: { normalizeWhitespace: boolean; disableCombineTextItems: boolean }): Promise<{
    items: Array<{ str: string; transform: number[] }>;
  }>;
};

type PdfParseResult = {
  text: string;
  numpages: number;
};

type PdfParse = (buffer: Buffer, options: { pagerender: (page: PdfPageData) => Promise<string> }) => Promise<PdfParseResult>;

// The package root executes a CLI-style example when bundled by Next.js.
// Importing the parser implementation directly avoids that build-time side effect.
const pdfParse = require("pdf-parse/lib/pdf-parse") as PdfParse;

export type ExtractedPdfText = {
  text: string;
  pages: string[];
  pageCount: number;
};

async function renderPage(page: PdfPageData) {
  const content = await page.getTextContent({ normalizeWhitespace: true, disableCombineTextItems: false });
  let previousY: number | undefined;
  let text = "";

  for (const item of content.items) {
    const y = item.transform[5];
    text += previousY === undefined || previousY === y ? item.str : `\n${item.str}`;
    previousY = y;
  }

  return `${text}\f`;
}

export async function extractPdfText(content: Buffer): Promise<ExtractedPdfText> {
  let parsed: PdfParseResult;
  try {
    parsed = await pdfParse(content, { pagerender: renderPage });
  } catch {
    throw new Error("无法读取该 PDF：文件可能已损坏、加密或不包含可提取文本。");
  }

  const pages = parsed.text.split("\f").map((page) => page.trim()).filter(Boolean);
  const text = pages.join("\f");
  if (!text) {
    throw new Error("无法读取该 PDF：文件不包含可提取文本，可能是扫描件；请先进行 OCR。");
  }

  return { text, pages, pageCount: parsed.numpages };
}
