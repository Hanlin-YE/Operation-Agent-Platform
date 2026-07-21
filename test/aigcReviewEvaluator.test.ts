import assert from "node:assert/strict";
import test from "node:test";
import { GET as getAigcReviews } from "@/app/api/aigc/reviews/route";
import { buildAigcCreationPlan } from "@/server/aigc/creationPlanner";
import { buildAigcReview } from "@/server/aigc/reviewEvaluator";
import { submitRunningHubJob } from "@/server/aigc/runningHubAdapter";
import type { AigcAdapterJob, AigcCreationRequest } from "@/server/aigc/types";

process.env.DEMO_EPHEMERAL_STORE = "true";

function resetAigcStore() {
  delete (globalThis as typeof globalThis & { __AIGC_JOB_STORE__?: unknown }).__AIGC_JOB_STORE__;
}

function request(overrides: Partial<AigcCreationRequest> = {}): AigcCreationRequest {
  return {
    requirement: "做一个 30 秒的小红书短视频，面向年轻运营人，讲 AI 如何把选题、脚本和分镜串起来，突出省时间和能出爆款文案。",
    platform: "runninghub",
    videoType: "xiaohongshu",
    durationSec: 30,
    aspectRatio: "9:16",
    styleTone: "真实办公场景、轻快、有记忆点",
    promptLanguage: "zh",
    ...overrides
  };
}

function approvedAssets(assetIds: string[]) {
  return assetIds.map((assetId) => ({ assetId, status: "approved" as const }));
}

function jobFor(input: AigcCreationRequest): AigcAdapterJob {
  const plan = buildAigcCreationPlan(input);
  return {
    jobId: `job-${input.requirement.slice(0, 8)}`,
    projectId: "project-review",
    platform: "runninghub",
    status: "mock_queued",
    submitMode: "mock",
    projectTitle: plan.projectTitle,
    request: input,
    adapter: plan.adapter,
    execution: plan.execution,
    assetApprovals: approvedAssets(plan.assets.map((asset) => asset.assetId)),
    payloadPreview: {},
    planSnapshot: plan,
    createdAt: "2026-07-21T00:00:00.000Z",
    updatedAt: "2026-07-21T00:00:00.000Z",
    logs: [],
    events: []
  };
}

test("AIGC 评测根据真实输入生成不同证据和点评", () => {
  const xhsReview = buildAigcReview(jobFor(request()));
  const industrialReview = buildAigcReview(jobFor(request({
    requirement: "做一个 45 秒的工业产品卖点视频，面向采购经理，突出空心杯电机在医疗泵里的稳定性和低噪音。",
    videoType: "product_ad",
    durationSec: 45,
    aspectRatio: "16:9",
    styleTone: "工业质感、克制、可信"
  })));

  assert.notEqual(xhsReview.matchedInputs[0], industrialReview.matchedInputs[0]);
  assert.notEqual(xhsReview.dimensions.find((item) => item.id === "adaptation")?.evidence, industrialReview.dimensions.find((item) => item.id === "adaptation")?.evidence);
  assert.ok(xhsReview.matchedInputs.some((item) => item.includes("年轻运营人")));
  assert.ok(industrialReview.matchedInputs.some((item) => item.includes("采购经理")));
});

test("AIGC 评测对输入不匹配、缺少转场和缺少资产引用降分", () => {
  const matched = buildAigcReview(jobFor(request()));
  const poorJob = jobFor(request({ requirement: "给咖啡店新品拿铁写一个周末探店短视频。" }));
  poorJob.planSnapshot = undefined;
  poorJob.execution = poorJob.execution.map((task) => ({
    ...task,
    payload: {
      ...task.payload,
      prompt: "工业设备在车间运行，展示稳定、性能和应用场景。",
      tailFrameRequirement: "",
      requiredAssets: []
    }
  }));
  const poor = buildAigcReview(poorJob);

  assert.ok((poor.dimensions.find((item) => item.id === "adaptation")?.score || 0) < (matched.dimensions.find((item) => item.id === "adaptation")?.score || 0));
  assert.ok((poor.dimensions.find((item) => item.id === "continuity")?.score || 0) < (matched.dimensions.find((item) => item.id === "continuity")?.score || 0));
  assert.ok((poor.dimensions.find((item) => item.id === "storyboard")?.score || 0) < (matched.dimensions.find((item) => item.id === "storyboard")?.score || 0));
  assert.ok(poor.dimensions.find((item) => item.id === "adaptation")?.feedback.includes("咖啡店"));
});

test("AIGC 评测证据来自任务真实内容且不展示模拟格式", () => {
  const input = request();
  const report = buildAigcReview(jobFor(input));
  const corpus = JSON.stringify(jobFor(input));
  const forbidden = /mock|monk|模拟模式|模拟执行|模拟排队/i;

  assert.doesNotMatch(JSON.stringify(report), forbidden);
  for (const dimension of report.dimensions) {
    assert.ok(dimension.evidence.length > 0);
    assert.ok(corpus.includes(dimension.evidence) || report.matchedInputs.join("\n").includes(dimension.evidence) || dimension.evidence.includes(input.requirement));
  }
});

test("GET /api/aigc/reviews 返回提交后任务的评测并保留 planSnapshot", async () => {
  resetAigcStore();
  const input = request();
  const plan = buildAigcCreationPlan(input);
  const submitted = await submitRunningHubJob({
    request: input,
    plan,
    submitMode: "mock",
    assetApprovals: approvedAssets(plan.assets.map((asset) => asset.assetId)),
    actor: { id: "test", role: "operator" }
  });
  const response = await getAigcReviews(new Request("http://localhost/api/aigc/reviews"));
  const payload = await response.json() as { reviews: Array<{ jobId: string; matchedInputs: string[]; dimensions: { id: string }[]; planCaptured: boolean }> };

  assert.equal(response.status, 200);
  assert.equal(payload.reviews[0].jobId, submitted.jobId);
  assert.equal(payload.reviews[0].planCaptured, true);
  assert.ok(payload.reviews[0].matchedInputs.some((item) => item.includes(input.requirement)));
  assert.deepEqual(payload.reviews[0].dimensions.map((item) => item.id), ["continuity", "innovation", "storyboard", "adaptation"]);
});
