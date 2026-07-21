import assert from "node:assert/strict";
import test from "node:test";
import { analyzeMarket } from "../src/server/agents/marketAnalysisAgent";
import { TikhubXiaohongshuSource } from "../src/server/sources/xiaohongshu";

test("授权小红书来源返回可追溯的公开信号", async () => {
  const source = new TikhubXiaohongshuSource({
    apiKey: "test-key",
    fetcher: async () => new Response(JSON.stringify({
      data: {
        items: [{
          note_id: "note-123",
          title: "机器人关节模组的温升测试",
          desc: "正在寻找空心杯电机样品，关注温升、噪声和交期。",
          share_url: "https://www.xiaohongshu.com/explore/note-123",
          user: { user_id: "user-123", nickname: "机器人研发团队" }
        }]
      }
    }), { status: 200, headers: { "content-type": "application/json" } })
  });
  const signals = await source.searchSignals({ focus: "robotics", limit: 1 });
  assert.equal(signals.length, 1);
  assert.equal(signals[0].scenario, "robotics");
  assert.equal(signals[0].noteUrl, "https://www.xiaohongshu.com/explore/note-123");
  assert.equal(signals[0].sourceStatus, "授权接口返回");
  assert.equal(signals[0].sourceName, "小红书公开内容（Tikhub 授权接口）");
  assert.ok(signals[0].collectedAt);
  assert.equal(source.status().mode, "授权公开数据");
});

test("未配置授权密钥时不展示演示公开信号", async () => {
  const source = new TikhubXiaohongshuSource({ apiKey: "" });
  const signals = await source.searchSignals({ focus: "robotics", limit: 1 });
  assert.deepEqual(signals, []);
  assert.equal(source.status().mode, "未配置");
});

test("市场分析报告组合授权公开信号数据", async () => {
  process.env.DEMO_EPHEMERAL_STORE = "true";
  const source = new TikhubXiaohongshuSource({
    apiKey: "test-key",
    fetcher: async () => new Response(JSON.stringify({
      data: { items: [{ note_id: "note-456", title: "样机采购", desc: "空心杯电机打样询价", share_url: "https://www.xiaohongshu.com/explore/note-456", user: { user_id: "user-456", nickname: "测试账号" } }] }
    }), { status: 200, headers: { "content-type": "application/json" } })
  });
  const report = await analyzeMarket("robotics", source);
  assert.equal(report.focus, "robotics");
  assert.ok(report.xiaohongshuSignals?.length);
  assert.equal(report.xiaohongshuSignals?.[0].sourceStatus, "授权接口返回");
  assert.equal(report.sourceStatus?.xiaohongshu, "授权公开数据");
  assert.equal(report.modelVersion, "market-analysis-rules-v2");
});
