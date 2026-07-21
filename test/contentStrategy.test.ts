import test from "node:test";
import assert from "node:assert/strict";
import { analyzeContentStrategy } from "../src/server/contentStrategy/service";
import { createContentStrategy } from "../src/server/repositories/contentStrategies";
import { POST as createDraft } from "../src/app/api/content-strategies/[id]/create-draft/route";
import { POST as requestRework } from "../src/app/api/content-strategies/[id]/request-rework/route";

test("content strategy never fabricates an analysis when server model key is absent", async () => {
  const old = process.env.OPENAI_API_KEY; delete process.env.OPENAI_API_KEY; process.env.DEMO_EPHEMERAL_STORE = "true";
  const result = await analyzeContentStrategy({ platform: "xiaohongshu", title: "工业电机选型", content: "样本正文", metrics: {}, images: [] });
  assert.equal(result.status, "model_not_configured"); assert.equal(result.analysis, undefined);
  if (old) process.env.OPENAI_API_KEY = old;
});

test("content strategy rejects oversized manual input before model invocation", async () => {
  await assert.rejects(() => analyzeContentStrategy({ platform: "other", title: "标题", content: "a".repeat(12001), metrics: {}, images: [] }), /不能超过/);
});

test("an approved strategy still requires an explicit human production confirmation", async () => {
  process.env.DEMO_EPHEMERAL_STORE = "true";
  const strategy = await createContentStrategy({
    status: "approved", version: 1, sample: { platform: "other", title: "标题", content: "正文", metrics: {}, images: [] },
    analysis: { confidence: "low", missingData: [], evidence: ["人工样本"], hook: "钩子", structure: ["结构"], rhythm: "节奏", audience: "受众", reusableMethods: ["方法"], b2bRisks: [], evidenceRequirements: [], recommendations: { wechat: "方向", xhsImage: "方向", xhsVideo: "方向" } },
    review: { operator: "运营", reviewedAt: new Date().toISOString() }
  });
  const response = await createDraft(new Request("http://localhost"), { params: { id: strategy.id } });
  assert.equal(response.status, 409);
});

test("rework requires feedback and supersedes the former strategy", async () => {
  process.env.DEMO_EPHEMERAL_STORE = "true";
  const strategy = await createContentStrategy({ status: "approved", version: 1, sample: { platform: "other", title: "标题", content: "正文", metrics: {}, images: [] }, analysis: { confidence: "low", missingData: [], evidence: ["样本"], hook: "钩子", structure: ["结构"], rhythm: "节奏", audience: "受众", reusableMethods: ["方法"], b2bRisks: [], evidenceRequirements: [], recommendations: { wechat: "方向", xhsImage: "方向", xhsVideo: "方向" } } });
  const missing = await requestRework(new Request("http://localhost", { method: "POST", body: JSON.stringify({ stage: "strategy_review" }) }), { params: { id: strategy.id } });
  assert.equal(missing.status, 422);
  const response = await requestRework(new Request("http://localhost", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ stage: "strategy_review", reason: "补足证据" }) }), { params: { id: strategy.id } });
  assert.equal(response.status, 201);
  const oldDraft = await createDraft(new Request("http://localhost"), { params: { id: strategy.id } });
  assert.equal(oldDraft.status, 409);
});
