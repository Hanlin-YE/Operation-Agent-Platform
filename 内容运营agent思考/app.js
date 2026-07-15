const state = {
  sources: [],
  digest: null,
  isAnalyzing: false,
  lastAnalysisError: null,
};

const CODEX_BRIDGE_ENDPOINT = "http://127.0.0.1:8765/api/codex-ingest";
const MAX_VIDEO_FRAMES = 12;

const els = {
  fileInput: document.querySelector("#file-input"),
  dropzone: document.querySelector("#dropzone"),
  demoButton: document.querySelector("#demo-button"),
  clearButton: document.querySelector("#clear-button"),
  digestButton: document.querySelector("#digest-button"),
  exportButton: document.querySelector("#export-button"),
  meetingContext: document.querySelector("#meeting-context"),
  projectMemory: document.querySelector("#project-memory"),
  statusPill: document.querySelector("#status-pill"),
  fileCount: document.querySelector("#file-count"),
  fileCountLabel: document.querySelector("#file-count-label"),
  sourceSummaryGrid: document.querySelector("#source-summary-grid"),
  analysisNotice: document.querySelector("#analysis-notice"),
  fileGrid: document.querySelector("#file-grid"),
  fileTemplate: document.querySelector("#file-card-template"),
  heroDigest: document.querySelector("#hero-digest"),
  confidence: document.querySelector("#digest-confidence"),
  metricGrid: document.querySelector("#metric-grid"),
  actionList: document.querySelector("#action-list"),
  opportunityList: document.querySelector("#opportunity-list"),
  publishGrid: document.querySelector("#publish-grid"),
  evidenceList: document.querySelector("#evidence-list"),
  searchInput: document.querySelector("#search-input"),
  previewDialog: document.querySelector("#preview-dialog"),
  previewDialogTitle: document.querySelector("#preview-dialog-title"),
  previewDialogImage: document.querySelector("#preview-dialog-image"),
  previewCloseButton: document.querySelector("#preview-close-button"),
};

const sourceTypeConfig = {
  slide: { label: "PPT", icon: "P", hint: "可能是演示页，优先抽取观点/项目名" },
  whiteboard: { label: "白板", icon: "W", hint: "可能有待办和讨论结构" },
  poster: { label: "海报", icon: "E", hint: "可能有活动、报名、联系人" },
  card: { label: "名片", icon: "C", hint: "可能有联系人和机构" },
  screenshot: { label: "截图", icon: "S", hint: "可能有群聊、链接、议程" },
  audio: { label: "录音", icon: "A", hint: "已生成播放器；可补充转写" },
  video: { label: "视频", icon: "V", hint: "已生成视频预览；可补充转写" },
  text: { label: "文本", icon: "T", hint: "直接进入会议语料" },
  pdf: { label: "PDF", icon: "PDF", hint: "已生成 PDF 预览；可补充 OCR" },
  office: { label: "文档", icon: "DOC", hint: "浏览器不可直接预览；可转 PDF/TXT" },
  document: { label: "文档", icon: "D", hint: "可作为文档证据；可补充摘要" },
  image: { label: "图片", icon: "I", hint: "已生成图片预览；可补充 OCR" },
  unknown: { label: "素材", icon: "F", hint: "作为辅助证据" },
};

const demoSources = [
  {
    id: "demo-1",
    name: "IMG_001_PPT_short_drama_agent.jpg",
    type: "slide",
    size: 920000,
    demoVisual: "slide",
    meta: { width: 1920, height: 1080 },
    content:
      "短剧 AIGC 生产痛点：角色一致性、批量生成、审核成本。嘉宾提到需要一个 workflow 把分镜、素材生成和质量检查连起来。",
  },
  {
    id: "demo-2",
    name: "IMG_002_whiteboard_followups.jpg",
    type: "whiteboard",
    size: 610000,
    demoVisual: "whiteboard",
    meta: { width: 1600, height: 1200 },
    content:
      "白板待办：联系林老师确认 Agent-to-Agent demo；查上海 AI 活动报名链接；整理 Hermes skills 会议素材入口。",
  },
  {
    id: "demo-3",
    name: "IMG_003_event_poster_shanghai_ai.jpg",
    type: "poster",
    size: 770000,
    demoVisual: "poster",
    meta: { width: 1240, height: 1754 },
    content:
      "上海 AI 创作者活动，主办方 FutureLab，报名二维码在右下角。圆桌主题：个人知识工作流入口。",
  },
  {
    id: "demo-4",
    name: "roundtable_audio_3min.m4a",
    type: "audio",
    size: 3840000,
    demoVisual: "audio",
    meta: { duration: 186 },
    content:
      "00:42 嘉宾说：大家不是没有记录，而是记录没有进入工作系统。01:18 某公司在招 AI agent 实习生。02:06 可以把会议素材变成可搜索、可回顾、可行动的资产。",
  },
  {
    id: "demo-5",
    name: "notes_wechat_forward.md",
    type: "text",
    size: 1800,
    demoVisual: "text",
    meta: {},
    content:
      "会后想发一条朋友圈：今天最有启发的是，高信息密度人群需要的不是更多记录工具，而是信号消化器。跟进私信：想约 20 分钟聊聊会议素材自动整理。",
  },
];

const sourceGroupLabels = {
  image: "图片",
  slide: "图片",
  whiteboard: "图片",
  poster: "图片",
  card: "图片",
  screenshot: "图片",
  audio: "音频",
  video: "视频",
  text: "文本",
  pdf: "PDF",
  office: "文档",
  document: "文档",
  unknown: "其他",
};

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatBytes(bytes = 0) {
  if (!bytes) return "0 KB";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** index;
  return `${value.toFixed(value >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
}

function detectSourceType(file) {
  const name = file.name.toLowerCase();
  const mime = file.type || "";
  if (mime.startsWith("audio/")) return "audio";
  if (mime.startsWith("video/")) return "video";
  if (name.match(/\.(txt|md|csv|json)$/)) return "text";
  if (name.match(/\.pdf$/) || mime === "application/pdf") return "pdf";
  if (name.match(/\.(doc|docx|ppt|pptx|xls|xlsx)$/)) return "office";
  if (name.includes("whiteboard") || name.includes("白板")) return "whiteboard";
  if (name.includes("poster") || name.includes("agenda") || name.includes("海报") || name.includes("议程")) return "poster";
  if (name.includes("card") || name.includes("名片")) return "card";
  if (name.includes("ppt") || name.includes("slide") || name.includes("deck")) return "slide";
  if (name.includes("screenshot") || name.includes("截屏") || name.includes("截图")) return "screenshot";
  if (mime.startsWith("image/")) return "image";
  return "unknown";
}

function readTextFile(file) {
  return new Promise((resolve) => {
    if (!file || !file.name.match(/\.(txt|md|csv|json)$/i)) {
      resolve("");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => resolve("");
    reader.readAsText(file);
  });
}

function readImageUrl(file) {
  return new Promise((resolve) => {
    if (!file || !(file.type || "").startsWith("image/")) {
      resolve("");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => resolve("");
    reader.readAsDataURL(file);
  });
}

function readImageMeta(file) {
  return new Promise((resolve) => {
    if (!file || !(file.type || "").startsWith("image/")) {
      resolve({});
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const image = new Image();
      image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
      image.onerror = () => resolve({});
      image.src = String(reader.result || "");
    };
    reader.onerror = () => resolve({});
    reader.readAsDataURL(file);
  });
}

function readMediaMeta(file, type) {
  return new Promise((resolve) => {
    if (!file || !["audio", "video"].includes(type)) {
      resolve({});
      return;
    }
    const element = document.createElement(type);
    const url = URL.createObjectURL(file);
    element.preload = "metadata";
    element.onloadedmetadata = () => {
      const meta = {
        duration: Number.isFinite(element.duration) ? element.duration : 0,
        width: element.videoWidth || 0,
        height: element.videoHeight || 0,
      };
      URL.revokeObjectURL(url);
      resolve(meta);
    };
    element.onerror = () => {
      URL.revokeObjectURL(url);
      resolve({});
    };
    element.src = url;
  });
}

function canPreviewWithObjectUrl(file, type) {
  return ["audio", "video", "pdf", "office", "document", "unknown"].includes(type) || Boolean(file);
}

function dataUrlToFile(dataUrl, filename) {
  const [header, payload] = dataUrl.split(",");
  const mime = header.match(/data:(.*?);base64/)?.[1] || "image/jpeg";
  const binary = atob(payload || "");
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new File([bytes], filename, { type: mime });
}

function seekVideo(video, time) {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      video.removeEventListener("seeked", handleSeeked);
      video.removeEventListener("error", handleError);
    };
    const handleSeeked = () => {
      cleanup();
      resolve();
    };
    const handleError = () => {
      cleanup();
      reject(new Error("视频抽帧失败。"));
    };
    video.addEventListener("seeked", handleSeeked, { once: true });
    video.addEventListener("error", handleError, { once: true });
    video.currentTime = time;
  });
}

async function captureVideoFrames(source) {
  if (!source.file || source.type !== "video" || !source.objectUrl) return [];
  const duration = source.meta?.duration || 0;
  if (!duration) return [];

  const video = document.createElement("video");
  video.muted = true;
  video.preload = "auto";
  video.src = source.objectUrl;
  video.crossOrigin = "anonymous";
  await new Promise((resolve, reject) => {
    video.onloadedmetadata = resolve;
    video.onerror = () => reject(new Error("无法读取视频元数据。"));
  });

  const width = video.videoWidth || source.meta?.width || 1280;
  const height = video.videoHeight || source.meta?.height || 720;
  const scale = Math.min(1, 1280 / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const ctx = canvas.getContext("2d");

  const frameCount = Math.min(MAX_VIDEO_FRAMES, Math.max(1, Math.floor(duration / 60) || 1));
  const times = Array.from({ length: frameCount }, (_, index) => {
    const ratio = (index + 1) / (frameCount + 1);
    return Math.min(Math.max(duration * ratio, 0.5), Math.max(duration - 0.5, 0.5));
  });

  const frames = [];
  for (const time of times) {
    await seekVideo(video, time);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
    const timestamp = formatDuration(time);
    frames.push({
      parentId: source.id,
      name: `${source.name}__frame_${timestamp.replace(":", "m")}s.jpg`,
      type: "image",
      kind: "video_frame",
      timestamp,
      file: dataUrlToFile(dataUrl, `${source.name}__frame_${timestamp.replace(":", "m")}s.jpg`),
    });
  }
  return frames;
}

async function addFiles(fileList) {
  const files = [...fileList];
  const additions = await Promise.all(
    files.map(async (file) => {
      const type = detectSourceType(file);
      const objectUrl = canPreviewWithObjectUrl(file, type) ? URL.createObjectURL(file) : "";
      const [previewUrl, content, imageMeta, mediaMeta] = await Promise.all([
        readImageUrl(file),
        readTextFile(file),
        readImageMeta(file),
        readMediaMeta(file, type),
      ]);
      return {
        id: crypto.randomUUID(),
        name: file.name,
        type,
        size: file.size,
        file,
        objectUrl,
        previewUrl,
        content,
        analysisStatus: "preview",
        analysisSummary: "",
        limitations: [],
        meta: { ...imageMeta, ...mediaMeta },
      };
    }),
  );

  state.sources.push(...additions);
  state.digest = null;
  state.lastAnalysisError = null;
  renderFiles();
  renderEmptyDigest();
}

function renderFiles() {
  const countText = `${state.sources.length} 个文件`;
  if (els.fileCount) els.fileCount.textContent = countText;
  if (els.fileCountLabel) els.fileCountLabel.textContent = countText;
  els.statusPill.textContent = state.sources.length ? "素材已导入" : "等待素材";
  renderAnalysisNotice();
  renderSourceSummary();
  els.fileGrid.innerHTML = "";

  if (!state.sources.length) {
    els.fileGrid.innerHTML = '<div class="empty-state"><span>把素材丢进左侧，或加载演示素材。</span></div>';
    return;
  }

  state.sources.forEach((source) => {
    const node = els.fileTemplate.content.firstElementChild.cloneNode(true);
    const config = sourceTypeConfig[source.type] || sourceTypeConfig.unknown;
    const thumb = node.querySelector(".thumb");
    const note = node.querySelector(".source-note");

    node.dataset.sourceId = source.id;
    node.querySelector(".file-name").textContent = source.name;
    node.querySelector(".type-badge").textContent = config.label;
    node.querySelector(".file-meta").textContent = `${formatBytes(source.size)} · ${formatSourceMeta(source)}`;
    node.querySelector(".file-insights").textContent = summarizeSourceReadiness(source, config);
    node.dataset.analysisStatus = source.analysisStatus || "preview";
    note.value = source.content || "";
    note.addEventListener("input", (event) => {
      source.content = event.target.value;
    });

    thumb.innerHTML = renderSourcePreview(source, config);
    const previewButton = thumb.querySelector("[data-preview-url]");
    if (previewButton) {
      previewButton.addEventListener("click", () => openImagePreview(previewButton.dataset.previewUrl, previewButton.dataset.previewTitle));
    }

    els.fileGrid.appendChild(node);
  });
}

function renderSourceSummary() {
  if (!els.sourceSummaryGrid) return;
  const groups = getSourceGroups();
  const totalDuration = state.sources.reduce((sum, source) => sum + (source.meta?.duration || 0), 0);
  const analyzed = state.sources.filter((source) => source.analysisStatus === "done").length;
  const failed = state.sources.filter((source) => ["error", "skipped"].includes(source.analysisStatus)).length;
  const cards = [
    ["总素材", `${state.sources.length}`],
    ["图片", `${groups["图片"] || 0}`],
    ["音视频", `${(groups["音频"] || 0) + (groups["视频"] || 0)}`],
    ["已识别", `${analyzed}`],
  ];
  if (failed > 0) cards.push(["需处理", `${failed}`]);
  if (totalDuration > 0) cards.push(["总时长", formatDuration(totalDuration)]);
  els.sourceSummaryGrid.innerHTML = state.sources.length
    ? cards
        .map(
          ([label, value]) => `
            <div class="source-summary-card">
              <b>${escapeHtml(value)}</b>
              <span>${escapeHtml(label)}</span>
            </div>
          `,
        )
        .join("")
    : "";
}

function renderAnalysisNotice() {
  if (!els.analysisNotice) return;
  if (state.lastAnalysisError) {
    els.analysisNotice.className = "analysis-notice is-error";
    els.analysisNotice.innerHTML = `
      <strong>${escapeHtml(state.lastAnalysisError.title)}</strong>
      <span>${escapeHtml(state.lastAnalysisError.message)}</span>
    `;
    return;
  }
  if (!state.sources.length) {
    els.analysisNotice.className = "analysis-notice";
    els.analysisNotice.innerHTML = `
      <strong>导入即预览，处理交给 Codex</strong>
      <span>这个网页负责整理素材包；点击右侧按钮后会把原始文件、备注、视频抽帧和上下文保存到本地工作区，随后由 Codex 直接读取处理。</span>
    `;
    return;
  }
  const done = state.sources.filter((source) => source.analysisStatus === "done").length;
  els.analysisNotice.className = "analysis-notice";
  els.analysisNotice.innerHTML = `
    <strong>${state.isAnalyzing ? "正在交给 Codex" : `${done}/${state.sources.length} 个素材已打包`}</strong>
    <span>${state.isAnalyzing ? "请保持页面打开。素材包会保存到本地 codex-inbox 目录。" : "点击右侧按钮，把这批材料交给本机 Codex 处理。"}</span>
  `;
}

function getSourceGroups() {
  return state.sources.reduce((acc, source) => {
    const label = sourceGroupLabels[source.type] || "其他";
    acc[label] = (acc[label] || 0) + 1;
    return acc;
  }, {});
}

function formatDuration(seconds = 0) {
  if (!seconds) return "0:00";
  const minutes = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${minutes}:${String(secs).padStart(2, "0")}`;
}

function formatSourceMeta(source) {
  const parts = [];
  if (source.meta?.duration) parts.push(`时长 ${formatDuration(source.meta.duration)}`);
  if (source.meta?.width && source.meta?.height) parts.push(`${source.meta.width}×${source.meta.height}`);
  if (source.content?.trim()) parts.push("已读取文本");
  return parts.length ? parts.join(" · ") : "已建立素材档案";
}

function summarizeSourceReadiness(source, config) {
  if (source.analysisStatus === "analyzing") return "正在保存到本地素材包。";
  if (source.analysisStatus === "done") return source.analysisSummary || "已保存到本地素材包，等待 Codex 读取处理。";
  if (source.analysisStatus === "error") return source.analysisSummary || "保存失败，请确认本地 bridge 已启动。";
  if (source.content?.trim()) return "已读取文本或备注；交给 Codex 时会一起保存。";
  if (source.type === "audio") return "已读取音频时长和播放器；交给 Codex 时会保存原始录音。";
  if (source.type === "video") return "已读取视频预览、时长和分辨率；交给 Codex 时会保存原视频并抽取画面帧。";
  if (source.previewUrl) return "已读取图片预览和尺寸；交给 Codex 时会保存原图。";
  if (source.type === "pdf") return "已建立 PDF 预览；交给 Codex 时会保存原始 PDF。";
  return config.hint;
}

function openImagePreview(url, title) {
  if (!url || !els.previewDialog) return;
  els.previewDialogTitle.textContent = title || "素材预览";
  els.previewDialogImage.src = url;
  els.previewDialogImage.alt = title || "素材预览";
  els.previewDialog.showModal();
}

function renderSourcePreview(source, config) {
  if (source.previewUrl) {
    return `<button class="preview-shell preview-image" type="button" data-preview-url="${escapeHtml(source.previewUrl)}" data-preview-title="${escapeHtml(source.name)}">
      <img src="${source.previewUrl}" alt="${escapeHtml(source.name)}" />
    </button>`;
  }

  if (source.objectUrl && source.type === "audio") {
    return `<div class="preview-shell preview-audio">
      <span class="preview-symbol">${escapeHtml(config.icon)}</span>
      <strong>录音可播放</strong>
      <audio controls src="${source.objectUrl}"></audio>
    </div>`;
  }

  if (source.objectUrl && source.type === "video") {
    return `<video class="preview-shell preview-video" controls src="${source.objectUrl}"></video>`;
  }

  if (source.objectUrl && source.type === "pdf") {
    return `<iframe class="preview-shell preview-pdf" title="${escapeHtml(source.name)}" src="${source.objectUrl}#toolbar=0&navpanes=0"></iframe>`;
  }

  if (source.type === "text" && source.content) {
    return `<pre class="preview-shell preview-text">${escapeHtml(truncateText(source.content, 560))}</pre>`;
  }

  if (source.type === "office") {
    return `<div class="preview-shell preview-unavailable">
      <span class="preview-symbol">${escapeHtml(config.icon)}</span>
      <strong>浏览器不能直接预览 Office 文档</strong>
      <small>请转成 PDF/TXT，或后续接文档解析器。</small>
    </div>`;
  }

  if (source.demoVisual) {
    return renderDemoVisual(source.demoVisual);
  }

  return `<div class="preview-shell preview-unavailable">
    <span class="preview-symbol">${escapeHtml(config.icon)}</span>
    <strong>已导入，可作为证据</strong>
    <small>当前格式暂不支持内嵌预览。</small>
  </div>`;
}

function truncateText(value, maxLength) {
  const text = String(value || "").trim();
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

function renderDemoVisual(kind) {
  const visualCopy = {
    slide: ["AIGC", "角色一致性", "批量生成", "审核成本"],
    whiteboard: ["联系", "报名", "整理", "发布"],
    poster: ["Shanghai AI", "FutureLab", "Roundtable"],
    audio: ["00:42", "01:18", "02:06"],
    text: ["朋友圈", "X", "公众号"],
  };
  const lines = visualCopy[kind] || ["Memory", "Inbox"];
  return `<div class="demo-visual">${lines.map((line) => `<span>${escapeHtml(line)}</span>`).join("")}</div>`;
}

function renderEmptyDigest() {
  els.confidence.textContent = "未生成";
  els.heroDigest.innerHTML = "<p>生成后，这里会显示这堆素材对你有什么用。</p>";
  els.metricGrid.innerHTML = '<p class="empty-copy">还没有会议包。</p>';
  els.actionList.innerHTML = '<p class="empty-copy">还没有行动项。</p>';
  els.opportunityList.innerHTML = '<p class="empty-copy">还没有机会匹配。</p>';
  els.publishGrid.innerHTML = '<p class="empty-copy">还没有发布草稿。</p>';
  els.evidenceList.innerHTML = '<p class="empty-copy">还没有证据索引。</p>';
}

function splitSentences(text) {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[。！？!?；;])|(?=\d{1,2}:\d{2})/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function getCorpus() {
  const context = els.meetingContext.value.trim();
  const sourceChunks = state.sources.map((source) => {
    const config = sourceTypeConfig[source.type] || sourceTypeConfig.unknown;
    const content = source.content?.trim() || "";
    return `[${source.name} | ${config.label}] ${content || config.hint}`;
  });
  return [context, ...sourceChunks].filter(Boolean).join("\n");
}

function getAnalysisCorpus(includeContext = true) {
  const context = includeContext ? els.meetingContext.value.trim() : "";
  const sourceChunks = state.sources
    .map((source) => {
      const text = source.content?.trim();
      if (text) return `[${source.name}] ${text}`;
      return "";
    })
    .filter(Boolean);
  return [context, ...sourceChunks].filter(Boolean).join("\n");
}

function setAnalyzing(value) {
  state.isAnalyzing = value;
  els.digestButton.disabled = value;
  els.digestButton.textContent = value ? "正在交给 Codex..." : "交给 Codex 一键总结";
  if (value) els.statusPill.textContent = "打包中";
  renderAnalysisNotice();
}

function setSourceStatus(status, ids = state.sources.map((source) => source.id), summary = "") {
  const idSet = new Set(ids);
  state.sources.forEach((source) => {
    if (!idSet.has(source.id)) return;
    source.analysisStatus = status;
    if (summary) source.analysisSummary = summary;
  });
  renderFiles();
}

function applyBackendSourceRecords(records = []) {
  const byId = new Map(state.sources.map((source) => [source.id, source]));
  const childRecordsByParent = new Map();

  records.forEach((record) => {
    if (record.parentId) {
      const rows = childRecordsByParent.get(record.parentId) || [];
      rows.push(record);
      childRecordsByParent.set(record.parentId, rows);
      return;
    }

    const source = byId.get(record.id);
    if (!source) return;
    source.analysisStatus = record.status === "done" ? "done" : record.status || "done";
    source.analysisSummary = record.summary || "";
    source.limitations = record.limitations || [];
    if (record.extracted_text?.trim()) source.content = record.extracted_text.trim();
  });

  childRecordsByParent.forEach((recordsForParent, parentId) => {
    const source = byId.get(parentId);
    if (!source) return;
    const frameText = recordsForParent
      .map((record) => {
        const stamp = record.metadata?.timestamp || record.name;
        const text = record.extracted_text || record.summary || "";
        return text.trim() ? `[视频画面 ${stamp}] ${text.trim()}` : "";
      })
      .filter(Boolean)
      .join("\n\n");
    if (frameText) {
      source.content = [source.content, frameText].filter(Boolean).join("\n\n");
      if (source.analysisStatus !== "error") source.analysisStatus = "done";
      source.analysisSummary = "视频画面已抽帧并完成视觉识别。";
    }
  });
}

async function buildAnalysisPayload() {
  const form = new FormData();
  const manifest = [];
  const manualSources = [];

  form.append("context", els.meetingContext.value.trim());
  form.append("projectMemory", els.projectMemory.value.trim());

  for (const source of state.sources) {
    if (source.file) {
      form.append("files", source.file, source.name);
      manifest.push({
        id: source.id,
        name: source.name,
        type: source.type,
        mime: source.file.type || "",
        kind: "original",
      });
    }

    if (source.type === "video") {
      try {
        const frames = await captureVideoFrames(source);
        frames.forEach((frame) => {
          form.append("files", frame.file, frame.name);
          manifest.push({
            id: crypto.randomUUID(),
            parentId: frame.parentId,
            name: frame.name,
            type: "image",
            mime: frame.file.type || "image/jpeg",
            kind: "video_frame",
            timestamp: frame.timestamp,
          });
        });
      } catch (error) {
        source.limitations = [...(source.limitations || []), error.message];
      }
    }

    const manualContent = source.content?.trim();
    const isTextFile = source.type === "text";
    if (manualContent && (!source.file || !isTextFile)) {
      manualSources.push({
        id: `${source.id}-manual-note`,
        parentId: source.id,
        name: `${source.name} / 手动补充`,
        type: "manual_note",
        kind: "manual_note",
        content: manualContent,
        meta: source.meta || {},
      });
    }
  }

  form.append("manifest", JSON.stringify(manifest));
  form.append("manual_sources", JSON.stringify(manualSources));
  return form;
}

async function handoffToCodex() {
  if (!state.sources.length) {
    state.lastAnalysisError = {
      title: "还没有素材",
      message: "先导入图片、音频、视频或文本，再交给 Codex 处理。",
    };
    renderFiles();
    return;
  }

  state.lastAnalysisError = null;
  setSourceStatus("analyzing", undefined, "正在保存到本地 Codex 素材包。");
  setAnalyzing(true);
  renderEmptyDigest();

  try {
    const form = await buildAnalysisPayload();
    const response = await fetch(CODEX_BRIDGE_ENDPOINT, {
      method: "POST",
      body: form,
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data.ok) {
      throw new Error(data.message || `本地 Codex bridge 保存失败：HTTP ${response.status}`);
    }

    state.sources.forEach((source) => {
      source.analysisStatus = "done";
      source.analysisSummary = source.file ? "原始文件已保存到本地素材包。" : "补充文本已保存到本地素材包。";
    });
    renderCodexHandoffResult(data);
    els.statusPill.textContent = "已交给 Codex";
    renderFiles();
  } catch (error) {
    state.sources.forEach((source) => {
      if (source.analysisStatus === "analyzing") {
        source.analysisStatus = "preview";
        source.analysisSummary = "";
      }
    });
    state.lastAnalysisError = {
      title: "本地 Codex bridge 未就绪",
      message:
        error.message ||
        "请先在项目目录运行：node local-bridge.mjs。网页不能直接写入本机文件，必须通过这个本地服务把素材包交给 Codex。",
    };
    els.statusPill.textContent = "需要启动 bridge";
    renderFiles();
    renderCodexBridgeError(state.lastAnalysisError);
  } finally {
    setAnalyzing(false);
  }
}

function renderCodexHandoffResult(result) {
  els.confidence.textContent = "已生成任务包";
  els.heroDigest.innerHTML = `
    <div class="digest-title">
      <strong>素材包已交给 Codex 工作区</strong>
      <span>${escapeHtml(result.package_dir || "")}</span>
    </div>
    <ul class="digest-list">
      <li><b>1</b><span>真实上传的原始文件会保存到 <code>materials/</code>。</span></li>
      <li><b>2</b><span>上下文、栏目和素材清单已保存到 <code>manifest.json</code>。</span></li>
      <li><b>3</b><span>给 Codex 的处理任务已保存到 <code>prompt.md</code>。</span></li>
    </ul>
  `;
  els.metricGrid.innerHTML = `
    <article class="metric-card">
      <span>1</span>
      <strong>素材包目录</strong>
      <p><b>${escapeHtml(result.package_id || "aftermeet")}</b></p>
      <p>${escapeHtml(result.package_dir || "")}</p>
    </article>
    <article class="metric-card">
      <span>2</span>
      <strong>下一步</strong>
      <p><b>让 Codex 读取 prompt.md</b></p>
      <p>我可以直接读取这个目录，识别图片、音频、视频和文本后生成 report.md。</p>
    </article>
  `;
  els.actionList.innerHTML = `
    <article class="action-card">
      <div>
        <p class="card-kicker">Codex</p>
        <h4 class="card-title">读取素材包并生成报告</h4>
        <p class="card-detail">${escapeHtml(result.prompt_path || "")}</p>
      </div>
      <span class="priority">P0</span>
    </article>
  `;
  els.opportunityList.innerHTML = '<p class="empty-copy">报告由 Codex 处理后生成。</p>';
  els.publishGrid.innerHTML = '<p class="empty-copy">发布草稿由 Codex 处理后生成。</p>';
  els.evidenceList.innerHTML = `
    <article class="evidence-card">
      <div>
        <p class="card-kicker">Package</p>
        <h4 class="card-title">manifest.json</h4>
        <p class="card-detail">${escapeHtml(result.manifest_path || "")}</p>
      </div>
    </article>
  `;
}

function normalizeBackendReport(report = {}, records = []) {
  const material = report.material_summary || {};
  const findings = report.key_findings || [];
  const reviewItems = report.five_minute_review || [];
  const validInfo = [
    {
      label: "素材概况",
      value: material.headline || `${state.sources.length} 个素材`,
      detail: material.detail || summarizeBackendRecords(records),
    },
    ...reviewItems.slice(0, 5).map((item, index) => ({
      label: `回看要点 ${index + 1}`,
      value: truncateText(item, 34),
      detail: item,
    })),
  ];

  findings.slice(0, Math.max(0, 6 - validInfo.length)).forEach((finding) => {
    validInfo.push({
      label: "关键结论",
      value: finding.title || "结论",
      detail: finding.detail || "",
    });
  });

  const actions = (report.action_items || []).map((item, index) => ({
    id: `backend-action-${index}`,
    title: item.title || "待办",
    detail: item.detail || item.title || "",
    priority: item.priority || "P1",
    evidence: arrayOrFallback(item.evidence),
    kind: item.owner || "行动",
  }));

  const opportunities = (report.opportunities || []).map((item) => ({
    project: item.project || "机会",
    score: item.score ?? (item.evidence?.length || 1),
    hits: [item.reason, item.next_step].filter(Boolean),
    evidence: arrayOrFallback(item.evidence),
  }));

  const publish = (report.publishable_snippets || []).map((item) => ({
    title: item.title || item.channel || "发布草稿",
    text: item.text || "",
  }));

  const evidence = (report.evidence_index || []).map((item) => ({
    claim: item.claim || "证据",
    detail: [item.locator, item.quote].filter(Boolean).join("：") || item.source || "",
    evidence: arrayOrFallback([item.source].filter(Boolean)),
    type: "证据",
  }));

  const limitations = (report.limitations || []).map((item, index) => ({
    claim: `限制 ${index + 1}`,
    detail: item,
    evidence: [],
    type: "限制",
  }));

  return {
    title: report.title || "素材知识报告",
    sourceSummary: material.headline || summarizeBackendRecords(records),
    executiveSummary: report.executive_summary || "",
    entities: [],
    actions: actions.length ? actions : extractActions(getAnalysisCorpus(false)),
    opportunities: opportunities.length ? opportunities : matchOpportunities(getAnalysisCorpus(true)),
    themes: [],
    validInfo: validInfo.length ? validInfo : buildDigestFallbackValidInfo(),
    publish: publish.length ? publish : buildPublishDrafts({ topTheme: "素材报告", topOpportunity: "知识库", actions }),
    evidence: [...evidence, ...limitations],
    confidence: Math.round(report.confidence || 78),
    backend: true,
  };
}

function summarizeBackendRecords(records = []) {
  const done = records.filter((record) => record.status === "done").length;
  const skipped = records.filter((record) => record.status === "skipped").length;
  const errors = records.filter((record) => record.status === "error").length;
  return `${done} 个来源完成识别，${skipped} 个跳过，${errors} 个失败。`;
}

function buildDigestFallbackValidInfo() {
  const snapshot = state.digest;
  buildDigest();
  const fallback = state.digest?.validInfo || [];
  state.digest = snapshot;
  return fallback;
}

function arrayOrFallback(value, fallback = "识别结果") {
  if (Array.isArray(value) && value.length) return value.map((item) => String(item));
  if (typeof value === "string" && value) return [value];
  return [fallback];
}

function renderCodexBridgeError(error) {
  els.confidence.textContent = "Bridge 未启动";
  els.heroDigest.innerHTML = `
    <div class="digest-title">
      <strong>${escapeHtml(error.title)}</strong>
      <span>${escapeHtml(error.message)}</span>
    </div>
    <ul class="digest-list">
      <li><b>1</b><span>在项目目录运行：<code>node local-bridge.mjs</code></span></li>
      <li><b>2</b><span>保持这个本地服务运行，再点击“交给 Codex 一键总结”。</span></li>
      <li><b>3</b><span>素材包会保存到 <code>codex-inbox/</code>，我可以直接读取并生成报告。</span></li>
    </ul>
  `;
  els.metricGrid.innerHTML = `
    <article class="metric-card">
      <span>1</span>
      <strong>本地 bridge</strong>
      <p><b>未启动</b></p>
      <p>${escapeHtml(error.message)}</p>
    </article>
  `;
  els.actionList.innerHTML = '<p class="empty-copy">启动本地 bridge 后，素材包会交给 Codex 处理。</p>';
  els.opportunityList.innerHTML = '<p class="empty-copy">报告由 Codex 处理后生成。</p>';
  els.publishGrid.innerHTML = '<p class="empty-copy">发布草稿由 Codex 处理后生成。</p>';
  els.evidenceList.innerHTML = '<p class="empty-copy">证据索引由 Codex 处理后生成。</p>';
}

function extractEntities(text) {
  const patterns = [
    { kind: "person", pattern: /(?:林|王|张|李|陈|周|赵|刘|黄|何|吴|郑)[\u4e00-\u9fa5]{1,2}(?:老师|总|同学)?/g },
    { kind: "org", pattern: /[\u4e00-\u9fa5A-Za-z0-9]{2,}(?:公司|大学|学院|资本|实验室|工作室|研究院|团队|主办方|FutureLab)/g },
    { kind: "project", pattern: /[A-Z][A-Za-z0-9-]*(?:\s+[A-Z][A-Za-z0-9-]*)*/g },
  ];
  const stop = new Set(["IMG", "PPT", "AI", "A", "AfterMeet", "Memory Inbox", "JPG", "JPEG", "PNG", "M4A", "MP3", "WAV"]);
  const found = new Map();
  patterns.forEach(({ kind, pattern }) => {
    [...text.matchAll(pattern)].forEach((match) => {
      const item = match[0].trim();
      if (item.length < 2 || stop.has(item.toUpperCase())) return;
      const current = found.get(item) || { name: item, count: 0, kind };
      current.count += 1;
      current.kind = current.kind === "person" ? current.kind : kind;
      found.set(item, current);
    });
  });
  return [...found.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 12)
    .map(({ name, count, kind }) => ({ name, count, kind }));
}

function sourceText(source) {
  const config = sourceTypeConfig[source.type] || sourceTypeConfig.unknown;
  return `${source.name} ${config.label} ${source.content || ""}`;
}

function findSourcesFor(query) {
  const words = String(query)
    .split(/[\s，,。:：；;、]+/)
    .map((word) => word.trim())
    .filter((word) => word.length >= 2);

  const matches = state.sources.filter((source) => {
    const haystack = sourceText(source).toLowerCase();
    return words.some((word) => haystack.includes(word.toLowerCase()));
  });

  return (matches.length ? matches : state.sources.slice(0, 2)).map((source) => source.name);
}

function extractActions(corpus) {
  const sentences = splitSentences(corpus);
  const actions = sentences
    .filter(hasActionSignal)
    .filter(isConcreteAction)
    .slice(0, 8)
    .map((sentence, index) => ({
      id: `action-${index}`,
      title: cleanActionTitle(sentence),
      detail: sentence,
      priority: index < 2 ? "P0" : index < 5 ? "P1" : "P2",
      evidence: findSourcesFor(sentence),
      kind: inferActionKind(sentence),
    }));

  if (actions.length) return actions;

  return [
    {
      id: "action-fallback-1",
      title: "补充每份素材的 OCR / 转写备注",
      detail: "当前素材还缺少可分析文本，先在素材卡片里补充你记得的关键信息。",
      priority: "P0",
      evidence: state.sources.map((source) => source.name).slice(0, 3),
      kind: "整理",
    },
  ];
}

function hasActionSignal(sentence) {
  const directSignals = ["联系", "报名", "跟进", "查询", "整理", "加入", "约", "确认", "私信", "申请", "下载"];
  if (directSignals.some((signal) => sentence.includes(signal))) return true;
  return /(^|[：:；;，,\s])查(?!看|验|重|证)/.test(sentence) || /(^|[：:；;，,\s])(写|发)(一条|一段|一篇|朋友圈|公众号|X|推文|内容|私信)/.test(sentence);
}

function isConcreteAction(sentence) {
  const metaSignals = ["重点想知道", "目标：把", "输出：", "支持", "生成 5 分钟", "发布草稿和证据索引"];
  if (metaSignals.some((signal) => sentence.includes(signal))) return false;
  return sentence.length <= 120;
}

function cleanActionTitle(sentence) {
  const trimmed = sentence.replace(/^\d{1,2}:\d{2}\s*/, "").replace(/^白板待办[:：]\s*/, "");
  const colon = trimmed.split(/[。；;!！?？]/)[0] || trimmed;
  return colon.length > 28 ? `${colon.slice(0, 28)}...` : colon;
}

function inferActionKind(sentence) {
  if (sentence.includes("联系") || sentence.includes("约") || sentence.includes("私信")) return "联系人";
  if (sentence.includes("报名") || sentence.includes("加入") || sentence.includes("申请")) return "机会";
  if (sentence.includes("写") || sentence.includes("发") || sentence.includes("公众号") || sentence.includes("朋友圈")) return "发布";
  return "整理";
}

function parseProjectMemory(text) {
  return text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name, rest = ""] = line.split(/[:：]/);
      return {
        name: name.trim(),
        keywords: rest
          .split(/[、,，]/)
          .map((item) => item.trim())
          .filter(Boolean),
      };
    });
}

function matchOpportunities(corpus) {
  const projects = parseProjectMemory(els.projectMemory.value);
  const lowerCorpus = corpus.toLowerCase();
  const matches = projects
    .map((project) => {
      const hits = project.keywords.filter((keyword) => lowerCorpus.includes(keyword.toLowerCase()));
      return {
        project: project.name,
        score: hits.length,
        hits,
        evidence: findSourcesFor([project.name, ...hits].join(" ")),
      };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);

  if (matches.length) return matches;

  return projects.slice(0, 3).map((project) => ({
    project: project.name,
    score: 0,
    hits: ["待补充关键词"],
    evidence: state.sources.map((source) => source.name).slice(0, 2),
  }));
}

function inferThemes(corpus) {
  const themeMap = [
    ["个人知识工作流", ["知识工作流", "工作系统", "可搜索", "可回顾", "可行动", "会议素材"]],
    ["AIGC 内容生产", ["AIGC", "短剧", "分镜", "角色一致性", "批量生成", "审核"]],
    ["Agent 自动化", ["agent", "Agent", "Hermes", "技能", "多智能体"]],
    ["活动与人脉", ["报名", "活动", "联系人", "主办方", "名片", "上海"]],
    ["内容发布", ["朋友圈", "公众号", "X", "发布", "项目灵感"]],
  ];
  return themeMap
    .map(([name, keywords]) => ({
      name,
      count: keywords.filter((keyword) => corpus.includes(keyword)).length,
      keywords,
    }))
    .filter((theme) => theme.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 4);
}

function classifySources() {
  return state.sources.reduce((acc, source) => {
    const label = sourceTypeConfig[source.type]?.label || "素材";
    acc[label] = (acc[label] || 0) + 1;
    return acc;
  }, {});
}

function buildDigest() {
  const corpus = getAnalysisCorpus(true);
  const actionCorpus = getAnalysisCorpus(false) || corpus;
  const entities = extractEntities(corpus);
  const actions = extractActions(actionCorpus);
  const opportunities = matchOpportunities(corpus);
  const themes = inferThemes(corpus);
  const sourceCounts = classifySources();
  const sourceSummary = Object.entries(sourceCounts)
    .map(([label, count]) => `${count} 份${label}`)
    .join("、");
  const topTheme = themes[0]?.name || "会议素材整理";
  const topOpportunity = opportunities[0]?.project || "你的既有项目";
  const importantViews = splitSentences(corpus)
    .filter((sentence) =>
      ["不是没有记录", "工作系统", "痛点", "机会", "workflow", "可搜索", "可行动", "一致性"].some((keyword) =>
        sentence.includes(keyword),
      ),
    )
    .slice(0, 3);

  const validInfo = [
    {
      label: "素材概况",
      value: sourceSummary || "尚未导入素材",
      detail: buildMaterialOverview(),
    },
    {
      label: "核心主题",
      value: topTheme,
      detail: importantViews[0] || "当前报告基于已导入素材、背景说明和手动补充文本生成。",
    },
    {
      label: "关键结论",
      value: importantViews[1] || topTheme,
      detail: importantViews[1] || "建议继续补充图片 OCR、音视频转写和现场备注，以提升报告精度。",
    },
    {
      label: "下一步行动",
      value: actions[0]?.title || "补充素材备注",
      detail: actions[0]?.detail || "给每个图片/音视频补充识别文本，再重新生成报告。",
    },
    {
      label: "知识库沉淀",
      value: topOpportunity,
      detail: `最相关栏目：${opportunities[0]?.hits.join("、") || "等待更多关键词"}`,
    },
    {
      label: "证据来源",
      value: `${state.sources.length || 0} 个索引`,
      detail: state.sources.length ? "报告中的结论会回到具体文件和补充文本。" : "导入素材后自动建立证据索引。",
    },
  ];

  const publish = buildPublishDrafts({ topTheme, topOpportunity, actions });
  const evidence = buildEvidenceIndex({ actions, opportunities, themes, entities });

  state.digest = {
    title: inferMeetingTitle(corpus, topTheme),
    sourceSummary,
    entities,
    actions,
    opportunities,
    themes,
    validInfo,
    publish,
    evidence,
    confidence: calculateReportReadiness(),
  };
}

function buildMaterialOverview() {
  const groups = getSourceGroups();
  const groupText = Object.entries(groups)
    .map(([label, count]) => `${count} 个${label}`)
    .join("、");
  const textCount = state.sources.filter((source) => source.content?.trim()).length;
  return groupText
    ? `${groupText}。其中 ${textCount} 个素材已有可分析文本。`
    : "还没有素材进入报告。";
}

function calculateReportReadiness() {
  if (!state.sources.length) return 0;
  const withText = state.sources.filter((source) => source.content?.trim()).length;
  const mediaKnown = state.sources.filter((source) => source.previewUrl || source.objectUrl || source.content?.trim()).length;
  return Math.min(96, Math.round(34 + state.sources.length * 6 + withText * 9 + mediaKnown * 3));
}

function pickContactEntity(entities, actions) {
  const contactSentence = actions.find((action) => action.kind === "联系人")?.detail || "";
  const fromContactSentence = entities.find((entity) => contactSentence.includes(entity.name));
  if (fromContactSentence) return fromContactSentence.name;
  const personOrOrg = entities.find((entity) => entity.kind === "person" || entity.kind === "org");
  return personOrOrg?.name || entities[0]?.name || "一个潜在合作方";
}

function inferMeetingTitle(corpus, topTheme) {
  const dateMatch = corpus.match(/20\d{2}[-/]\d{1,2}[-/]\d{1,2}/);
  const date = dateMatch ? dateMatch[0] : "今天";
  if (corpus.includes("上海")) return `${date} 上海 AI 活动复盘`;
  if (corpus.includes("圆桌")) return `${date} AI 圆桌会议包`;
  return `${date} ${topTheme}会议包`;
}

function buildPublishDrafts({ topTheme, topOpportunity, actions }) {
  const firstAction = actions[0]?.title || "补充素材识别文本";
  return [
    {
      title: "报告摘要",
      text: `这批素材主要围绕「${topTheme}」。已导入 ${state.sources.length} 个素材，系统已建立素材清单、证据索引和初步行动项。`,
    },
    {
      title: "知识库条目",
      text: `可归档到「${topOpportunity}」：保留素材来源、关键结论、行动项和可引用证据，后续可用于内容生产或项目复盘。`,
    },
    {
      title: "内容选题",
      text: `可延展选题：围绕「${topTheme}」写一篇素材复盘，结构为背景、关键发现、证据截图/录音、下一步行动。`,
    },
    {
      title: "跟进提醒",
      text: `下一步优先处理：${firstAction}。完成后再次生成报告，报告会更接近可归档版本。`,
    },
  ];
}

function buildEvidenceIndex({ actions, opportunities, themes, entities }) {
  const rows = [];
  actions.forEach((action) => {
    rows.push({
      claim: action.title,
      detail: action.detail,
      evidence: action.evidence,
      type: "行动项",
    });
  });
  opportunities.forEach((opportunity) => {
    rows.push({
      claim: `${opportunity.project} 可跟进`,
      detail: `匹配关键词：${opportunity.hits.join("、")}`,
      evidence: opportunity.evidence,
      type: "机会",
    });
  });
  themes.forEach((theme) => {
    rows.push({
      claim: theme.name,
      detail: `命中主题词：${theme.keywords.slice(0, 4).join("、")}`,
      evidence: findSourcesFor(theme.keywords.join(" ")),
      type: "观点",
    });
  });
  entities.slice(0, 5).forEach((entity) => {
    rows.push({
      claim: entity.name,
      detail: `在素材中出现 ${entity.count} 次`,
      evidence: findSourcesFor(entity.name),
      type: "实体",
    });
  });
  return rows.slice(0, 18);
}

function renderDigest() {
  if (!state.digest) {
    renderEmptyDigest();
    return;
  }

  els.statusPill.textContent = "已生成会议包";
  els.confidence.textContent = `可信度 ${state.digest.confidence}%`;
  els.heroDigest.innerHTML = `
    <div class="digest-title">
      <strong>${escapeHtml(state.digest.title)}</strong>
      <span>${escapeHtml(state.digest.sourceSummary || "基于当前素材与上下文生成")}</span>
    </div>
    <ul class="digest-list">
      ${state.digest.validInfo
        .slice(0, 5)
        .map((item, index) => `<li><b>${index + 1}</b><span>${escapeHtml(item.label)}：${escapeHtml(item.value)}</span></li>`)
        .join("")}
    </ul>
  `;

  els.metricGrid.innerHTML = state.digest.validInfo
    .map(
      (item, index) => `
        <article class="metric-card">
          <span>${index + 1}</span>
          <strong>${escapeHtml(item.label)}</strong>
          <p><b>${escapeHtml(item.value)}</b></p>
          <p>${escapeHtml(item.detail)}</p>
        </article>
      `,
    )
    .join("");

  els.actionList.innerHTML = state.digest.actions.map(renderAction).join("");
  els.opportunityList.innerHTML = state.digest.opportunities.map(renderOpportunity).join("");
  els.publishGrid.innerHTML = state.digest.publish.map(renderPublishCard).join("");
  renderEvidence();
}

function renderAction(action) {
  return `
    <article class="action-card">
      <div>
        <p class="card-kicker">${escapeHtml(action.kind)}</p>
        <h4 class="card-title">${escapeHtml(action.title)}</h4>
        <p class="card-detail">${escapeHtml(action.detail)}</p>
        <div class="tag-row">${action.evidence.map((item) => `<span class="tag">${escapeHtml(item)}</span>`).join("")}</div>
      </div>
      <span class="priority">${escapeHtml(action.priority)}</span>
    </article>
  `;
}

function renderOpportunity(opportunity) {
  return `
    <article class="opportunity-card">
      <div>
        <p class="card-kicker">匹配分 ${opportunity.score}</p>
        <h4 class="card-title">${escapeHtml(opportunity.project)}</h4>
        <p class="card-detail">这场会和它相关，因为素材里出现了：${escapeHtml(opportunity.hits.join("、"))}</p>
      </div>
      <div class="tag-row">${opportunity.evidence.map((item) => `<span class="tag">${escapeHtml(item)}</span>`).join("")}</div>
    </article>
  `;
}

function renderPublishCard(item) {
  return `
    <article class="publish-card">
      <div>
        <p class="card-kicker">Publish Mode</p>
        <h4 class="card-title">${escapeHtml(item.title)}</h4>
      </div>
      <textarea>${escapeHtml(item.text)}</textarea>
    </article>
  `;
}

function highlight(value, query) {
  if (!query) return escapeHtml(value);
  const safe = escapeHtml(value);
  const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return safe.replace(new RegExp(`(${escapedQuery})`, "gi"), "<mark>$1</mark>");
}

function renderEvidence() {
  if (!state.digest) return;
  const query = els.searchInput.value.trim();
  const rows = state.digest.evidence.filter((row) => {
    const haystack = `${row.claim} ${row.detail} ${row.evidence.join(" ")}`.toLowerCase();
    return !query || haystack.includes(query.toLowerCase());
  });

  els.evidenceList.innerHTML = rows.length
    ? rows
        .map(
          (row) => `
          <article class="evidence-card">
            <div>
              <p class="card-kicker">${escapeHtml(row.type)}</p>
              <h4 class="card-title">${highlight(row.claim, query)}</h4>
              <p class="card-detail">${highlight(row.detail, query)}</p>
            </div>
            <div class="tag-row">${row.evidence.map((item) => `<span class="tag">${highlight(item, query)}</span>`).join("")}</div>
          </article>
        `,
        )
        .join("")
    : '<p class="empty-copy">没有匹配的证据。</p>';
}

function exportMarkdown() {
  if (!state.digest) buildDigest();
  const digest = state.digest;
  const lines = [
    `# ${digest.title}`,
    "",
    `素材：${digest.sourceSummary || "无"}`,
    "",
    "## 5 分钟回看版",
    ...digest.validInfo.map((item, index) => `${index + 1}. ${item.label}：${item.value} - ${item.detail}`),
    "",
    "## 行动清单",
    ...digest.actions.map((item) => `- [${item.priority}] ${item.title}\n  来源：${item.evidence.join(" / ")}`),
    "",
    "## 机会匹配",
    ...digest.opportunities.map((item) => `- ${item.project}：${item.hits.join("、")}`),
    "",
    "## 发布草稿",
    ...digest.publish.map((item) => `### ${item.title}\n${item.text}`),
    "",
    "## 证据索引",
    ...digest.evidence.map((item) => `- ${item.claim}：${item.evidence.join(" / ")}`),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "aftermeet-report.md";
  anchor.click();
  URL.revokeObjectURL(url);
}

function activateTab(button) {
  document.querySelectorAll(".tab").forEach((tab) => tab.classList.remove("is-active"));
  document.querySelectorAll(".tab-panel").forEach((panel) => panel.classList.remove("is-active"));
  button.classList.add("is-active");
  document.querySelector(`#${button.dataset.tab}-panel`).classList.add("is-active");
}

function clearAll() {
  state.sources.forEach((source) => {
    if (source.objectUrl) URL.revokeObjectURL(source.objectUrl);
  });
  state.sources = [];
  state.digest = null;
  state.lastAnalysisError = null;
  els.fileInput.value = "";
  renderFiles();
  renderEmptyDigest();
}

function loadDemo() {
  clearAll();
  state.sources = demoSources.map((source) => ({ ...source }));
  els.meetingContext.value =
    "2026-06-06 上海 AI Event。目标：把现场 PPT、白板、海报、录音和微信笔记整理成一份清晰报告，提炼关键观点、行动项、机会和证据来源。";
  renderFiles();
  renderEmptyDigest();
}

els.fileInput.addEventListener("change", (event) => addFiles(event.target.files));
els.dropzone.addEventListener("dragover", (event) => {
  event.preventDefault();
  els.dropzone.classList.add("is-dragging");
});
els.dropzone.addEventListener("dragleave", () => els.dropzone.classList.remove("is-dragging"));
els.dropzone.addEventListener("drop", (event) => {
  event.preventDefault();
  els.dropzone.classList.remove("is-dragging");
  addFiles(event.dataTransfer.files);
});
els.demoButton.addEventListener("click", loadDemo);
els.clearButton.addEventListener("click", clearAll);
els.digestButton.addEventListener("click", handoffToCodex);
els.exportButton.addEventListener("click", exportMarkdown);
els.searchInput.addEventListener("input", renderEvidence);
document.querySelectorAll(".tab").forEach((button) => {
  button.addEventListener("click", () => activateTab(button));
});
els.previewCloseButton.addEventListener("click", () => els.previewDialog.close());
els.previewDialog.addEventListener("click", (event) => {
  if (event.target === els.previewDialog) els.previewDialog.close();
});

renderFiles();
renderEmptyDigest();
