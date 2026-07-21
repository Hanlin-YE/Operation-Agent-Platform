import assert from "node:assert/strict";
import test from "node:test";
import { analyzeComments } from "../src/server/analysis/commentAnalysis";
import { ingestWechatComments } from "../src/server/repositories/wechatComments";
import { createWechatOperatorJob, completeWechatOperatorJob } from "../src/server/repositories/wechatOperatorJobs";

test("评论分析按主题、情绪和风险生成可追溯结果", () => {
  const result = analyzeComments([
    { id: "c1", articleId: "a1", content: "电机温升太高，想知道寿命和交期", createdAt: "2026-07-20T01:00:00Z", status: "visible" },
    { id: "c2", articleId: "a1", content: "产品不错，能否提供样品测试", createdAt: "2026-07-20T02:00:00Z", status: "visible" },
    { id: "c3", articleId: "a2", content: "请联系我报价", createdAt: "2026-07-20T03:00:00Z", status: "visible" }
  ]);
  assert.equal(result.total, 3);
  assert.ok(result.themes.some((item) => item.name === "可靠性与温升"));
  assert.ok(result.themes.some((item) => item.name === "采购与报价"));
  assert.ok(result.sentiment.positive >= 1);
  assert.ok(result.risks.some((item) => item.type === "潜在线索"));
  assert.ok(result.evidence.every((item) => item.commentId));
});

test("评论同步按文章和原始评论 ID 幂等", async () => {
  process.env.DEMO_EPHEMERAL_STORE = "true";
  const payload = {
    article: { id: "a-dedupe", title: "测试文章", publishedAt: "2026-07-20T00:00:00Z" },
    comments: [{ id: "c-dedupe", articleId: "a-dedupe", content: "交期多久？", createdAt: "2026-07-20T01:00:00Z", status: "visible" as const }]
  };
  const first = await ingestWechatComments(payload);
  const second = await ingestWechatComments(payload);
  assert.equal(first.inserted, 1);
  assert.equal(second.inserted, 0);
  assert.equal(second.duplicates, 1);
});

test("受控采集任务可从排队到导入完成，且不自动创建销售线索", async () => {
  process.env.DEMO_EPHEMERAL_STORE = "true";
  const job = await createWechatOperatorJob({ articleQuery: "空心杯电机选型", maxPages: 1, requestedBy: "运营人员" });
  assert.equal(job.status, "queued");
  const result = await completeWechatOperatorJob(job.id, {
    article: { id: "operator-article", title: "空心杯电机选型", publishedAt: "2026-07-20T00:00:00Z" },
    comments: [{ id: "operator-comment", articleId: "operator-article", content: "请问交期多久", createdAt: "2026-07-20T01:00:00Z", status: "visible" }]
  });
  assert.equal(result.job.status, "completed");
  assert.equal(result.job.inserted, 1);
  assert.equal(result.job.leadCreation, "disabled");
});
