import assert from "node:assert/strict";
import test from "node:test";
import { buildSkillOrchestration, resolveImageBackend } from "../src/server/aigc/skillOrchestration";
import { buildAigcCreationPlan } from "../src/server/aigc/creationPlanner";

test("仅在明确启用原生 imagegen 时使用免费原生图片后端", () => {
  assert.equal(resolveImageBackend({ NATIVE_IMAGEGEN_AVAILABLE: "true" }).provider, "native_imagegen");
  assert.equal(resolveImageBackend({}).provider, "runninghub");
  assert.equal(resolveImageBackend({ NATIVE_IMAGEGEN_AVAILABLE: "1" }).provider, "runninghub");
});

test("内容创作计划编排五项已审核 Skill，并把公众号限制为草稿", () => {
  const orchestration = buildSkillOrchestration({ imageBackend: resolveImageBackend({}), requirement: "为空心杯电机制作获客内容" });

  assert.deepEqual(orchestration.skills.map((skill) => skill.id), [
    "content-creation-publisher",
    "baoyu-xhs-images",
    "video-creation-suite",
    "video-creation-collaborator",
    "baoyu-post-to-wechat"
  ]);
  assert.equal(orchestration.image.provider, "runninghub");
  assert.equal(orchestration.publish.mode, "draft_only");
  assert.equal(orchestration.publish.requiresHumanApproval, true);
  assert.deepEqual(orchestration.production.map((item) => item.platform), ["微信公众号", "小红书图文", "小红书短视频", "视频资产包"]);
  assert.ok(orchestration.production[0].copy.includes("空心杯电机"));
});

test("AIGC 创作计划将 Skill 编排和图片路由返回给工作台", () => {
  const plan = buildAigcCreationPlan({
    requirement: "生成电机产品的图文和视频内容",
    platform: "runninghub",
    videoType: "xiaohongshu",
    durationSec: 15,
    aspectRatio: "9:16",
    styleTone: "专业、清爽",
    promptLanguage: "zh"
  });

  assert.equal(plan.skillOrchestration.skills.length, 5);
  assert.equal(plan.skillOrchestration.image.provider, "runninghub");
  assert.equal(plan.workflow.length, 6);
  assert.ok(plan.continuity.narrativeTemplate.includes("Taotao"));
  assert.deepEqual(plan.shots.map((shot) => shot.shotId), ["SHOT_01", "SHOT_02", "SHOT_03", "SHOT_04", "SHOT_05"]);
  assert.ok(plan.execution.every((task, index) => String(task.payload.dependsOnShotId) === (index === 0 ? "asset approval" : `SHOT_0${index}`)));
});
