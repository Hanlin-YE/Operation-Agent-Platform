import assert from "node:assert/strict";
import test from "node:test";
import { createTianyanMarketPostHandler } from "../src/server/sources/tianyanMarketRoute";

test("天眼市场接口先返回企业候选，且仅在主体确认后读取市场情报", async () => {
  const requests: string[] = [];
  const post = createTianyanMarketPostHandler({
    searchCompanies: async (query) => {
      requests.push(`search:${query}`);
      return [{ companyName: "北京示例智能科技有限公司", companyId: "company-001", status: "存续" }];
    },
    getMarketProfile: async (companyName) => {
      requests.push(`profile:${companyName}`);
      return { companyName, registration: { status: "存续" }, risk: { summary: "已返回风险总览；建议人工查看明细" }, source: "天眼 AI" as const };
    }
  });

  const search = await post(new Request("http://localhost/api/market-intelligence/tianyan", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "search", query: "示例智能" })
  }));
  assert.equal(search.status, 200);
  assert.deepEqual(await search.json(), { action: "search", candidates: [{ companyName: "北京示例智能科技有限公司", companyId: "company-001", status: "存续" }] });

  const profile = await post(new Request("http://localhost/api/market-intelligence/tianyan", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "profile", companyName: "北京示例智能科技有限公司" })
  }));
  assert.equal(profile.status, 200);
  assert.equal((await profile.json()).profile.companyName, "北京示例智能科技有限公司");
  assert.deepEqual(requests, ["search:示例智能", "profile:北京示例智能科技有限公司"]);
});

test("天眼市场接口拒绝不支持的动作", async () => {
  const post = createTianyanMarketPostHandler({ searchCompanies: async () => [], getMarketProfile: async () => { throw new Error("不应调用"); } });
  const response = await post(new Request("http://localhost/api/market-intelligence/tianyan", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "all_in" })
  }));
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "unsupported_action" });
});
