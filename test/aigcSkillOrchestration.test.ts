import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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
  assert.ok(orchestration.production[0].strategy.includes("长文") || orchestration.production[0].strategy.includes("逻辑链"));
  assert.ok(orchestration.production[0].copy.length > 1500);
  assert.match(orchestration.production[0].copy, /一、为什么/);
  assert.match(orchestration.production[0].copy, /五、下一步/);
  assert.doesNotMatch(orchestration.production[0].copy, /公众号长文的优势|不需要像短视频|小红书图文/);
  assert.match(orchestration.production[0].copy, /电机|空心杯|转子|温升/);
  assert.ok(orchestration.production[1].imagePrompts?.some((prompt) => prompt.includes("小红书封面")));
});

test("内容平台可按目标筛选，并保留对应平台策略", () => {
  const orchestration = buildSkillOrchestration({
    imageBackend: resolveImageBackend({}),
    requirement: "为空心杯电机制作获客内容",
    targetPlatforms: ["wechat_article", "xhs_image_cards"]
  });

  assert.deepEqual(orchestration.production.map((item) => item.id), ["wechat_article", "xhs_image_cards"]);
  assert.ok(orchestration.production[0].copy.length > orchestration.production[1].title.length);
  assert.ok(orchestration.production[1].format.includes("提示词"));
  assert.ok(orchestration.production[1].imagePrompts?.length);
});

test("AIGC 创作计划将 Skill 编排和图片路由返回给工作台", () => {
  const plan = buildAigcCreationPlan({
    requirement: "生成电机产品的图文和视频内容",
    platform: "runninghub",
    targetPlatforms: ["xhs_image_cards"],
    videoType: "xiaohongshu",
    durationSec: 15,
    aspectRatio: "9:16",
    styleTone: "专业、清爽",
    promptLanguage: "zh"
  });

  assert.equal(plan.skillOrchestration.skills.length, 5);
  assert.deepEqual(plan.skillOrchestration.production.map((item) => item.id), ["xhs_image_cards"]);
  assert.equal(plan.skillOrchestration.image.provider, "runninghub");
  assert.equal(plan.workflow.length, 6);
  assert.ok(plan.continuity.narrativeTemplate.includes("Taotao"));
  assert.deepEqual(plan.shots.map((shot) => shot.shotId), ["SHOT_01", "SHOT_02", "SHOT_03", "SHOT_04", "SHOT_05"]);
  assert.ok(plan.execution.every((task, index) => String(task.payload.dependsOnShotId) === (index === 0 ? "asset approval" : `SHOT_0${index}`)));
});

test("AIGC 创作工作台不再展示生产适配说明卡片", () => {
  const source = readFileSync("src/components/content/AigcCreationWorkbench.tsx", "utf8");

  assert.doesNotMatch(source, /Adapter Strategy/);
  assert.doesNotMatch(source, /<h2>生产适配<\/h2>/);
  assert.doesNotMatch(source, /aigc-adapter-meta/);
});

test("AIGC 平台产出卡片提供复制正文入口", () => {
  const source = readFileSync("src/components/content/AigcCreationWorkbench.tsx", "utf8");

  assert.match(source, /copyProductionContent/);
  assert.match(source, /aria-label=\{`复制\$\{item\.title\}正文`\}/);
  assert.match(source, /aigc-copy-button/);
});
