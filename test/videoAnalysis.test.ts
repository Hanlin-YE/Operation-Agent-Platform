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
    script: { title: "样片拆解", summary: "以产品特写建立卖点，再进入应用场景。", beats: [{ startSec: 0, endSec: 3.2, visual: "产品特写", narration: "稳定输出，从选型开始。", purpose: "建立核心卖点" }] },
    warnings: ["视觉结论仅来自抽取的关键帧。"]
  });
  assert.equal(result.status, "needs_review");
  assert.equal(result.script!.beats[0].purpose, "建立核心卖点");
});

test("video analysis rejects incomplete or fabricated worker results", () => {
  assert.throws(() => parseVideoAnalysisResult({ jobId: "video-1", status: "needs_review" }), /结构不完整/);
});
