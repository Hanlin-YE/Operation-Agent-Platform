import assert from "node:assert/strict";
import test from "node:test";
import { TianyanAiSource } from "../src/server/sources/tianyanAi";

test("天眼 AI 先返回可供人工确认的企业候选，再聚合基础与风险概览", async () => {
  const commands: string[][] = [];
  const source = new TianyanAiSource({
    runner: async (args) => {
      commands.push(args);
      if (args[1] === "companies") {
        return JSON.stringify({ data: { items: [{
          name: "北京示例智能科技有限公司",
          id: "company-001",
          creditCode: "91110108TESTCOMPANY",
          regStatus: "存续",
          legalPersonName: "张三"
        }] } });
      }
      if (args[0] === "company") {
        return JSON.stringify({ data: {
          companyName: "北京示例智能科技有限公司",
          regStatus: "存续",
          legalPersonName: "张三",
          establishTime: "2020-01-01",
          regCapital: "1000万人民币",
          regLocation: "北京市海淀区"
        } });
      }
      return JSON.stringify({ data: { riskCount: 2, riskLevel: "中" } });
    }
  });

  const candidates = await source.searchCompanies("示例智能");
  assert.deepEqual(candidates, [{
    companyName: "北京示例智能科技有限公司",
    companyId: "company-001",
    creditCode: "91110108TESTCOMPANY",
    status: "存续",
    legalRepresentative: "张三"
  }]);

  const profile = await source.getMarketProfile(candidates[0].companyName);
  assert.equal(profile.companyName, "北京示例智能科技有限公司");
  assert.equal(profile.registration.status, "存续");
  assert.equal(profile.risk.summary, "风险等级：中；风险记录：2 条");
  assert.deepEqual(commands, [
    ["company", "companies", "示例智能"],
    ["company", "registration-info", "北京示例智能科技有限公司"],
    ["risk", "overview", "北京示例智能科技有限公司"]
  ]);
});

test("天眼 AI 不可用时给出不暴露凭据的本地运行提示", async () => {
  const source = new TianyanAiSource({ runner: async () => { throw new Error("spawn tyc ENOENT"); } });
  await assert.rejects(
    () => source.searchCompanies("示例智能"),
    { message: "天眼 AI 本地服务不可用。请确认当前设备已完成 tyc CLI 配置。" }
  );
});
