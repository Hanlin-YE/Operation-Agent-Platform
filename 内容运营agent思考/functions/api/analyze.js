const IMAGE_LIMIT_BYTES = limitFromEnv("AFTERMEET_IMAGE_LIMIT_MB", 64);
const TRANSCRIPTION_LIMIT_BYTES = limitFromEnv("AFTERMEET_TRANSCRIPTION_LIMIT_MB", 200);
const TEXT_LIMIT_CHARS = 120000;
const DEFAULT_TEXT_MODEL = "gpt-4o-mini";
const DEFAULT_TRANSCRIBE_MODEL = "whisper-1";

const jsonHeaders = {
  "content-type": "application/json; charset=utf-8",
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "content-type",
};

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: jsonHeaders });
  }

  if (request.method !== "POST") {
    return json({ ok: false, error: { code: "METHOD_NOT_ALLOWED", message: "Only POST is supported." } }, 405);
  }

  if (!env.OPENAI_API_KEY) {
    return json(
      {
        ok: false,
        error: {
          code: "MISSING_OPENAI_API_KEY",
          message: "Cloudflare Pages 还没有配置 OPENAI_API_KEY，所以无法进行真实图片识别、音频转写和报告生成。",
          next_step: "在 Cloudflare Pages 项目的 Settings > Environment variables 中添加 OPENAI_API_KEY 后重新部署。",
        },
      },
      503,
    );
  }

  let form;
  try {
    form = await request.formData();
  } catch (error) {
    return json(
      {
        ok: false,
        error: {
          code: "INVALID_FORM_DATA",
          message: "请求不是有效的 multipart/form-data。",
          detail: error.message,
        },
      },
      400,
    );
  }

  const contextText = textField(form, "context");
  const projectMemory = textField(form, "projectMemory");
  const manualSources = parseJsonArray(textField(form, "manual_sources"));
  const manifest = parseJsonArray(textField(form, "manifest"));
  const files = form.getAll("files").filter(isFileLike);

  if (!files.length && !manualSources.length) {
    return json(
      {
        ok: false,
        error: {
          code: "NO_SOURCES",
          message: "没有收到可分析的素材文件或手动文本。",
        },
      },
      400,
    );
  }

  const provider = {
    apiKey: env.OPENAI_API_KEY,
    baseUrl: stripTrailingSlash(env.OPENAI_BASE_URL || "https://api.openai.com/v1"),
    visionModel: env.OPENAI_VISION_MODEL || env.OPENAI_TEXT_MODEL || DEFAULT_TEXT_MODEL,
    reportModel: env.OPENAI_REPORT_MODEL || env.OPENAI_TEXT_MODEL || DEFAULT_TEXT_MODEL,
    transcribeModel: env.OPENAI_TRANSCRIBE_MODEL || DEFAULT_TRANSCRIBE_MODEL,
  };

  const sourceRecords = [];

  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];
    const item = manifest[index] || {};
    const record = await analyzeUploadedFile({ file, item, provider });
    sourceRecords.push(record);
  }

  manualSources.forEach((source) => {
    const content = truncate(String(source.content || ""), TEXT_LIMIT_CHARS);
    if (!content.trim()) return;
    sourceRecords.push({
      id: source.id || `manual-${sourceRecords.length + 1}`,
      parentId: source.parentId || null,
      name: source.name || "manual-note.txt",
      kind: source.kind || "manual_note",
      type: source.type || "text",
      status: "done",
      extracted_text: content,
      summary: "用户补充或文本文件中的可读内容，已直接纳入报告。",
      entities: [],
      actions: [],
      evidence: [source.name || "manual-note.txt"],
      limitations: [],
      metadata: source.meta || {},
    });
  });

  let report;
  try {
    report = await generateReport({ sourceRecords, contextText, projectMemory, provider });
  } catch (error) {
    return json(
      {
        ok: false,
        error: {
          code: "REPORT_GENERATION_FAILED",
          message: error.message || "模型报告生成失败。",
        },
        sources: sourceRecords,
      },
      502,
    );
  }

  return json({
    ok: true,
    generated_at: new Date().toISOString(),
    models: {
      vision: provider.visionModel,
      transcription: provider.transcribeModel,
      report: provider.reportModel,
    },
    sources: sourceRecords,
    report,
  });
}

async function analyzeUploadedFile({ file, item, provider }) {
  const mime = file.type || item.mime || "";
  const inferredType = item.type || inferType(file.name, mime);
  const baseRecord = {
    id: item.id || `source-${crypto.randomUUID()}`,
    parentId: item.parentId || null,
    name: item.name || file.name || "uploaded-file",
    kind: item.kind || "original",
    type: inferredType,
    status: "done",
    extracted_text: "",
    summary: "",
    entities: [],
    actions: [],
    evidence: [],
    limitations: [],
    metadata: {
      size: file.size || 0,
      mime,
      timestamp: item.timestamp || null,
    },
  };

  try {
    if (mime.startsWith("image/") || inferredType === "image") {
      return await analyzeImageFile({ file, baseRecord, provider });
    }

    if (mime.startsWith("audio/") || isTranscribableVideo(mime, file.name)) {
      return await transcribeMediaFile({ file, baseRecord, provider });
    }

    if (isReadableText(file.name, mime)) {
      const text = truncate(await file.text(), TEXT_LIMIT_CHARS);
      return {
        ...baseRecord,
        extracted_text: text,
        summary: text ? "文本文件已直接读取。" : "文本文件为空。",
        evidence: text ? [baseRecord.name] : [],
        limitations: text ? [] : ["没有读取到文本内容。"],
      };
    }

    return {
      ...baseRecord,
      status: "skipped",
      summary: "已收到文件，但当前后端还没有这个格式的解析器。",
      limitations: [`暂不支持直接解析 ${mime || "未知 MIME"}；可转成图片、音频、文本或 PDF 后再导入。`],
    };
  } catch (error) {
    return {
      ...baseRecord,
      status: "error",
      summary: "分析这个文件时发生错误。",
      limitations: [error.message || "未知错误"],
    };
  }
}

async function analyzeImageFile({ file, baseRecord, provider }) {
  if (file.size > IMAGE_LIMIT_BYTES) {
    return {
      ...baseRecord,
      status: "skipped",
      summary: "图片超过当前视觉识别大小限制。",
      limitations: [`图片大小 ${formatBytes(file.size)}，当前限制 ${formatBytes(IMAGE_LIMIT_BYTES)}。`],
    };
  }

  const dataUrl = await fileToDataUrl(file);
  const prompt = [
    "你是 AfterMeet 的素材识别器。请读取这张会议/活动/知识素材图片。",
    "目标不是泛泛描述，而是把可进入知识库和报告的内容抽出来。",
    "请只返回严格 JSON，字段如下：",
    "{",
    '  "extracted_text": "尽可能完整的可见文字/OCR/白板内容",',
    '  "summary": "这张图在讲什么，1-3 句",',
    '  "entities": ["人名/机构/项目/地点/活动"],',
    '  "actions": ["明确待办或可跟进行动"],',
    '  "evidence": ["可以回到图片位置的证据描述，例如 右下角二维码/标题/白板左侧"],',
    '  "limitations": ["看不清或不确定的地方"]',
    "}",
  ].join("\n");

  const output = await callResponses({
    provider,
    model: provider.visionModel,
    input: [
      {
        role: "user",
        content: [
          { type: "input_text", text: prompt },
          { type: "input_image", image_url: dataUrl },
        ],
      },
    ],
  });

  const parsed = parseModelJson(output);
  return {
    ...baseRecord,
    extracted_text: stringifyField(parsed.extracted_text || output),
    summary: stringifyField(parsed.summary || "图片已完成视觉识别。"),
    entities: arrayField(parsed.entities),
    actions: arrayField(parsed.actions),
    evidence: arrayField(parsed.evidence, baseRecord.name),
    limitations: arrayField(parsed.limitations),
  };
}

async function transcribeMediaFile({ file, baseRecord, provider }) {
  if (file.size > TRANSCRIPTION_LIMIT_BYTES) {
    return {
      ...baseRecord,
      status: "skipped",
      summary: "音视频超过当前转写大小限制。",
      limitations: [`文件大小 ${formatBytes(file.size)}，当前限制 ${formatBytes(TRANSCRIPTION_LIMIT_BYTES)}。`],
    };
  }

  const form = new FormData();
  form.append("model", provider.transcribeModel);
  form.append("file", file, file.name || baseRecord.name);
  form.append(
    "prompt",
    "这是一段会议、活动、访谈、路演或知识分享素材。请尽量保留人名、机构、项目、待办、时间点和可跟进机会。",
  );

  const response = await fetch(`${provider.baseUrl}/audio/transcriptions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${provider.apiKey}`,
    },
    body: form,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error?.message || `音频转写失败：HTTP ${response.status}`);
  }

  const transcript = data.text || data.transcript || "";
  return {
    ...baseRecord,
    extracted_text: transcript,
    summary: transcript ? "音视频已完成语音转写。" : "转写接口返回为空。",
    evidence: transcript ? [baseRecord.name] : [],
    limitations: transcript ? [] : ["没有获得可用转写文本。"],
  };
}

async function generateReport({ sourceRecords, contextText, projectMemory, provider }) {
  const compactSources = sourceRecords.map((source) => ({
    id: source.id,
    parentId: source.parentId,
    name: source.name,
    kind: source.kind,
    type: source.type,
    status: source.status,
    summary: source.summary,
    extracted_text: truncate(source.extracted_text || "", 12000),
    entities: source.entities || [],
    actions: source.actions || [],
    evidence: source.evidence || [],
    limitations: source.limitations || [],
    metadata: source.metadata || {},
  }));

  const prompt = [
    "你是 AfterMeet，一个自媒体知识库的素材消化 agent。",
    "用户会批量上传会议/活动/知识素材，包括图片、音频、视频抽帧、文本和备注。",
    "请基于素材证据生成一份非常清晰明确、可归档、可行动的中文报告。",
    "不要虚构没有证据的结论。每个重要结论都要指向 evidence_index。",
    "如果某些素材识别失败或能力不足，要写进 limitations。",
    "",
    "用户背景：",
    contextText || "未提供",
    "",
    "知识库栏目 / 关注方向：",
    projectMemory || "未提供",
    "",
    "素材识别结果 JSON：",
    JSON.stringify(compactSources, null, 2),
    "",
    "请只返回严格 JSON，字段如下：",
    "{",
    '  "title": "报告标题",',
    '  "executive_summary": "5-8 句话，告诉用户这批素材到底有什么用",',
    '  "material_summary": {"headline":"一句话素材概况","detail":"图片/音频/视频/文本分别读到了什么"},',
    '  "five_minute_review": ["5 分钟回看要点，5-7 条"],',
    '  "key_findings": [{"title":"关键结论","detail":"为什么重要","evidence":["文件名或来源 id"]}],',
    '  "action_items": [{"title":"待办","detail":"怎么做","priority":"P0/P1/P2","owner":"我/待确认","evidence":["来源"]}],',
    '  "opportunities": [{"project":"匹配的栏目或项目","reason":"为什么相关","next_step":"下一步","evidence":["来源"]}],',
    '  "publishable_snippets": [{"channel":"朋友圈/X/公众号/私信/选题","title":"草稿标题","text":"可直接改写发布的内容"}],',
    '  "evidence_index": [{"claim":"结论或事实","source":"文件名","locator":"画面位置/时间点/文本段落/抽帧时间","quote":"短引用或摘要"}],',
    '  "limitations": ["识别失败、缺少后端能力、证据不足等"],',
    '  "confidence": 0',
    "}",
  ].join("\n");

  const output = await callResponses({
    provider,
    model: provider.reportModel,
    input: [{ role: "user", content: [{ type: "input_text", text: prompt }] }],
  });

  const parsed = parseModelJson(output);
  return {
    title: stringifyField(parsed.title || "素材知识报告"),
    executive_summary: stringifyField(parsed.executive_summary || output),
    material_summary: objectField(parsed.material_summary),
    five_minute_review: arrayField(parsed.five_minute_review),
    key_findings: arrayObjects(parsed.key_findings),
    action_items: arrayObjects(parsed.action_items),
    opportunities: arrayObjects(parsed.opportunities),
    publishable_snippets: arrayObjects(parsed.publishable_snippets),
    evidence_index: arrayObjects(parsed.evidence_index),
    limitations: arrayField(parsed.limitations).concat(collectSourceLimitations(sourceRecords)),
    confidence: clamp(Number(parsed.confidence || 72), 0, 100),
  };
}

async function callResponses({ provider, model, input }) {
  const response = await fetch(`${provider.baseUrl}/responses`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${provider.apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      input,
      temperature: 0.2,
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error?.message || `模型调用失败：HTTP ${response.status}`);
  }
  return extractResponseText(data);
}

function extractResponseText(data) {
  if (typeof data.output_text === "string") return data.output_text;
  const pieces = [];
  for (const item of data.output || []) {
    for (const content of item.content || []) {
      if (typeof content.text === "string") pieces.push(content.text);
      if (typeof content.output_text === "string") pieces.push(content.output_text);
    }
  }
  return pieces.join("\n").trim();
}

async function fileToDataUrl(file) {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return `data:${file.type || "image/jpeg"};base64,${btoa(binary)}`;
}

function parseModelJson(text) {
  const raw = String(text || "").trim();
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return {};
    try {
      return JSON.parse(match[0]);
    } catch {
      return {};
    }
  }
}

function parseJsonArray(value) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function textField(form, key) {
  const value = form.get(key);
  return typeof value === "string" ? value : "";
}

function isFileLike(value) {
  return value && typeof value === "object" && typeof value.arrayBuffer === "function";
}

function inferType(name = "", mime = "") {
  const lower = name.toLowerCase();
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("audio/")) return "audio";
  if (mime.startsWith("video/")) return "video";
  if (isReadableText(lower, mime)) return "text";
  if (lower.endsWith(".pdf") || mime === "application/pdf") return "pdf";
  return "unknown";
}

function isReadableText(name = "", mime = "") {
  return (
    mime.startsWith("text/") ||
    mime === "application/json" ||
    /\.(txt|md|csv|json)$/i.test(name)
  );
}

function isTranscribableVideo(mime = "", name = "") {
  return (
    mime.startsWith("video/") &&
    (mime.includes("mp4") || mime.includes("mpeg") || mime.includes("webm") || /\.(mp4|mpeg|mpg|webm|m4v|mov)$/i.test(name))
  );
}

function stringifyField(value) {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "";
  return JSON.stringify(value);
}

function arrayField(value, fallback) {
  if (Array.isArray(value)) return value.map((item) => stringifyField(item)).filter(Boolean);
  if (typeof value === "string" && value.trim()) return [value.trim()];
  return fallback ? [fallback] : [];
}

function arrayObjects(value) {
  return Array.isArray(value) ? value.filter((item) => item && typeof item === "object") : [];
}

function objectField(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function collectSourceLimitations(sources) {
  const rows = [];
  sources.forEach((source) => {
    (source.limitations || []).forEach((item) => {
      rows.push(`${source.name}: ${item}`);
    });
  });
  return rows;
}

function truncate(value, maxLength) {
  const text = String(value || "");
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function formatBytes(bytes = 0) {
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value.toFixed(value >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
}

function stripTrailingSlash(value) {
  return String(value || "").replace(/\/+$/, "");
}

function limitFromEnv(key, fallbackMb) {
  const value = Number(globalThis?.process?.env?.[key] || fallbackMb);
  const mb = Number.isFinite(value) && value > 0 ? value : fallbackMb;
  return mb * 1024 * 1024;
}

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: jsonHeaders,
  });
}
