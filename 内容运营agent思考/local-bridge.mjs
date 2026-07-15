import { createServer } from "node:http";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { Readable } from "node:stream";

const PORT = Number(process.env.AFTERMEET_BRIDGE_PORT || 8765);
const ROOT = resolve(process.env.AFTERMEET_INBOX_DIR || "codex-inbox");

const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "content-type",
};

function json(res, status, payload) {
  res.writeHead(status, {
    ...corsHeaders,
    "content-type": "application/json; charset=utf-8",
  });
  res.end(JSON.stringify(payload, null, 2));
}

function safeName(value, fallback = "source") {
  return String(value || fallback)
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 180);
}

function stamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

async function parseForm(req) {
  const request = new Request(`http://127.0.0.1:${PORT}${req.url}`, {
    method: req.method,
    headers: req.headers,
    body: Readable.toWeb(req),
    duplex: "half",
  });
  return request.formData();
}

function buildPrompt({ context, projectMemory, manifest, manualSources, packageDir }) {
  return [
    "# AfterMeet Codex 处理任务",
    "",
    "请读取本目录下的 `manifest.json` 和 `materials/` 中的原始材料，直接处理这批素材。",
    "",
    "## 目标",
    "",
    "生成一份清晰、可行动、可归档到自媒体知识库的报告。重点输出：",
    "",
    "1. 5 分钟回看版",
    "2. 核心观点和事实",
    "3. 行动清单",
    "4. 人 / 项目 / 机构索引",
    "5. 与关注方向的匹配",
    "6. 可发布内容草稿",
    "7. 证据来源索引",
    "",
    "## 报告背景",
    "",
    context || "未提供",
    "",
    "## 知识库栏目 / 关注方向",
    "",
    projectMemory || "未提供",
    "",
    "## 素材清单",
    "",
    ...manifest.map((item, index) => `${index + 1}. ${item.name} | ${item.type} | ${item.saved_path}`),
    "",
    "## 用户补充文本",
    "",
    manualSources.length ? manualSources.map((item) => `### ${item.name}\n${item.content}`).join("\n\n") : "无",
    "",
    "## 输出文件",
    "",
    `请把最终报告写成 Markdown，建议文件名：${packageDir}/report.md`,
    "",
  ].join("\n");
}

async function handleIngest(req, res) {
  const form = await parseForm(req);
  const context = String(form.get("context") || "");
  const projectMemory = String(form.get("projectMemory") || "");
  const originalManifest = JSON.parse(String(form.get("manifest") || "[]"));
  const manualSources = JSON.parse(String(form.get("manual_sources") || "[]"));
  const files = form.getAll("files");

  if (!files.length && !manualSources.length) {
    json(res, 400, {
      ok: false,
      error: "NO_SOURCES",
      message: "没有收到素材文件或补充文本。",
    });
    return;
  }

  const packageId = `aftermeet-${stamp()}`;
  const packageDir = join(ROOT, packageId);
  const materialDir = join(packageDir, "materials");
  await mkdir(materialDir, { recursive: true });

  const savedManifest = [];
  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];
    const item = originalManifest[index] || {};
    const name = safeName(item.name || file.name || `source-${index + 1}`);
    const savedPath = join(materialDir, name);
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(savedPath, buffer);
    savedManifest.push({
      ...item,
      name: item.name || file.name || name,
      saved_path: savedPath,
      size: buffer.length,
      mime: file.type || item.mime || "",
    });
  }

  const manifest = {
    package_id: packageId,
    created_at: new Date().toISOString(),
    package_dir: packageDir,
    context,
    project_memory: projectMemory,
    sources: savedManifest,
    manual_sources: manualSources,
  };

  await writeFile(join(packageDir, "manifest.json"), JSON.stringify(manifest, null, 2));
  await writeFile(
    join(packageDir, "prompt.md"),
    buildPrompt({ context, projectMemory, manifest: savedManifest, manualSources, packageDir }),
  );

  json(res, 200, {
    ok: true,
    package_id: packageId,
    package_dir: packageDir,
    manifest_path: join(packageDir, "manifest.json"),
    prompt_path: join(packageDir, "prompt.md"),
    source_count: savedManifest.length,
    manual_count: manualSources.length,
    next_step: "回到 Codex，让 Codex 读取这个素材包并生成 report.md。",
  });
}

const server = createServer(async (req, res) => {
  try {
    if (req.method === "OPTIONS") {
      res.writeHead(204, corsHeaders);
      res.end();
      return;
    }

    if (req.method === "GET" && req.url === "/health") {
      json(res, 200, { ok: true, inbox_dir: ROOT });
      return;
    }

    if (req.method === "POST" && req.url === "/api/codex-ingest") {
      await handleIngest(req, res);
      return;
    }

    json(res, 404, { ok: false, error: "NOT_FOUND" });
  } catch (error) {
    json(res, 500, {
      ok: false,
      error: "BRIDGE_ERROR",
      message: error.message,
    });
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`AfterMeet Codex bridge listening on http://127.0.0.1:${PORT}`);
  console.log(`Saving packages to ${ROOT}`);
});
