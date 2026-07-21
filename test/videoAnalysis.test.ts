import assert from "node:assert/strict";
import test from "node:test";
import { parseVideoAnalysisResult } from "../src/server/videoAnalysis/service";

test("video analysis accepts a complete evidence-backed script package", () => {
  const result = parseVideoAnalysisResult({
    jobId: "video-1",
    status: "needs_review",
    source: { filename: "sample.mp4", durationSec: 32 },
    transcript: [{ startSec: 0, endSec: 3.2, speaker: "旁白", text: "稳定输出，从选型开始。" }],
    scenes: [{ startSec: 0, endSec: 3.2, summary: "产品特写", evidence: ["场景切分", "语音转写"] }],
    script: {
      title: "样片拆解", summary: "以产品特写建立卖点，再进入应用场景。", storyOutline: "以技术痛点开场，再用产品证据回应。",
      viralBreakdown: { hook: "前三秒提出稳定性问题", structure: ["痛点", "证据", "行动"], reusablePatterns: ["用具体工况承接卖点"], b2bAdaptation: "改为样机测试场景", risks: ["不得把样片中的性能描述当作我方承诺"] },
      beats: [{ startSec: 0, endSec: 3.2, visual: "产品特写", narration: "稳定输出，从选型开始。", purpose: "建立核心卖点" }]
    },
    warnings: ["视觉结论仅来自抽取的关键帧。"]
  });
  assert.equal(result.status, "needs_review");
  assert.equal(result.script!.beats[0].purpose, "建立核心卖点");
});

test("video analysis requires a reviewable viral breakdown for URL-based reference analysis", () => {
  assert.throws(() => parseVideoAnalysisResult({
    jobId: "video-2", status: "needs_review", source: { filename: "reference.mp4", sourceUrl: "https://example.com/reference.mp4" }, transcript: [], scenes: [],
    script: { title: "缺少拉片结论", summary: "x", storyOutline: "x", beats: [] }, warnings: []
  }), /结构不完整/);
});

test("video analysis rejects incomplete or fabricated worker results", () => {
  assert.throws(() => parseVideoAnalysisResult({ jobId: "video-1", status: "needs_review" }), /结构不完整/);
});

test("video analysis accepts a persisted in-progress task snapshot", () => {
  const result = parseVideoAnalysisResult({
    jobId: "video-progress", status: "processing", step: "转写", percent: 45,
    message: "正在提取台词", logs: [{ at: "2026-07-21T00:00:00Z", level: "info", message: "开始" }],
    source: { filename: "reference.mp4" }, transcript: [], scenes: [], warnings: [],
    createdAt: "2026-07-21T00:00:00Z", updatedAt: "2026-07-21T00:00:00Z",
  });
  assert.equal(result.percent, 45);
  assert.equal(result.step, "转写");
});
