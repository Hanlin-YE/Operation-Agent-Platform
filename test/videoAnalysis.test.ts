import assert from "node:assert/strict";
import test from "node:test";
import { POST as createVideoAnalysisJob } from "../src/app/api/video-analysis/jobs/route";
import { GET as checkVideoAnalysisHealth } from "../src/app/api/video-analysis/health/route";
import { buildVideoReferenceScore, formatVideoAnalysisClientError, getVideoAnalysisJobPath, parseVideoAnalysisResult, validateVideoSourceUrl } from "../src/server/videoAnalysis/service";

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

test("video reference analysis builds strategy-only scoring from the split script", () => {
  const result = parseVideoAnalysisResult({
    jobId: "video-score",
    status: "needs_review",
    source: { filename: "sample.mp4", durationSec: 32 },
    transcript: [{ startSec: 0, endSec: 3.2, speaker: "旁白", text: "稳定输出，从选型开始。" }],
    scenes: [{ startSec: 0, endSec: 3.2, summary: "产品特写", evidence: ["场景切分", "语音转写"] }],
    script: {
      title: "样片拆解",
      summary: "以产品特写建立卖点，再进入应用场景。",
      storyOutline: "以技术痛点开场，承接样机测试，再回到客户选型行动。",
      viralBreakdown: {
        hook: "前三秒提出稳定性反差问题",
        structure: ["痛点", "证据", "行动"],
        reusablePatterns: ["用具体工况承接卖点", "用对比建立记忆点"],
        b2bAdaptation: "改为客户样机测试和选型场景",
        risks: ["不得把样片中的性能描述当作我方承诺"]
      },
      beats: [
        { startSec: 0, endSec: 3.2, visual: "产品特写", narration: "稳定输出，从选型开始。", purpose: "建立核心卖点" },
        { startSec: 3.2, endSec: 8, visual: "测试台对比", narration: "同样工况下看波动。", purpose: "证明应用场景" }
      ]
    },
    warnings: ["视觉结论仅来自抽取的关键帧。"]
  });
  const review = buildVideoReferenceScore(result);

  assert.ok(review);
  assert.equal(review.dimensions.map((item) => item.label).join(","), "故事连续性,创新性,分镜专业性,内容适配度");
  assert.equal(review.beatScores.length, 2);
  assert.ok(review.score >= 72);
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

test("persisted video jobs can be restored through the local job route", () => {
  assert.equal(getVideoAnalysisJobPath("video-abc/123"), "/api/video-analysis/jobs/video-abc%2F123");
});

test("browser URL errors are translated into an actionable local-service message", () => {
  assert.equal(formatVideoAnalysisClientError(new TypeError("The string did not match the expected pattern.")), "本地视频分析页面仍在使用旧地址，请刷新页面后重试。若仍失败，请确认本地 Agent 运行在 8001 端口。");
});

test("video source URL validation accepts public http links without browser pattern errors", () => {
  assert.equal(validateVideoSourceUrl(" https://b23.tv/example "), "https://b23.tv/example");
  assert.throws(() => validateVideoSourceUrl("b23.tv/example"), /完整的公开视频链接/);
  assert.throws(() => validateVideoSourceUrl("file:///tmp/video.mp4"), /HTTP\(S\)/);
});

test("video submission validates model configuration before any remote work", async (context) => {
  const old = process.env.OPENAI_API_KEY; const oldLlm = process.env.LLM_API_KEY;
  delete process.env.OPENAI_API_KEY; delete process.env.LLM_API_KEY;
  let calls = 0;
  context.mock.method(globalThis, "fetch", async () => { calls++; return Response.json({}); });
  try {
    const form = new FormData(); form.set("sourceUrl", "https://b23.tv/example");
    const response = await createVideoAnalysisJob(new Request("http://localhost/api/video-analysis/jobs", {method:"POST",body:form}));
    assert.equal(response.status,422); assert.match((await response.json()).error,/模型配置不完整/); assert.equal(calls,0);
  } finally {
    if(old)process.env.OPENAI_API_KEY=old;
    if(oldLlm)process.env.LLM_API_KEY=oldLlm;
  }
});

test("video analysis health check reports the configured local agent status", async (context) => {
  context.mock.method(globalThis, "fetch", async (input: Parameters<typeof fetch>[0]) => {
    assert.match(String(input), /\/healthz$/);
    return Response.json({ status: "ok" });
  });

  const response = await checkVideoAnalysisHealth();
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.ok, true);
  assert.match(payload.healthUrl, /\/healthz$/);
});
