import assert from "node:assert/strict";
import test from "node:test";
import { analyzeMarket } from "../src/server/agents/marketAnalysisAgent";
import { LocalXiaohongshuSource } from "../src/server/sources/xiaohongshu";

test("本地小红书来源按市场筛选并遵守数量上限", async () => {
  const source = new LocalXiaohongshuSource();
  const signals = await source.searchSignals({ focus: "robotics", limit: 1 });
  assert.equal(signals.length, 1);
  assert.equal(signals[0].scenario, "robotics");
  assert.equal(source.status().mode, "本地演示数据");
});

test("市场分析报告组合公开信号数据", async () => {
  process.env.DEMO_EPHEMERAL_STORE = "true";
  const report = await analyzeMarket("robotics", new LocalXiaohongshuSource());
  assert.equal(report.focus, "robotics");
  assert.ok(report.xiaohongshuSignals?.length);
  assert.equal(report.sourceStatus?.xiaohongshu, "本地演示数据");
  assert.equal(report.modelVersion, "market-analysis-rules-v2");
});
