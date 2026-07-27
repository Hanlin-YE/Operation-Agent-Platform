import assert from "node:assert/strict";
import test from "node:test";
import { compareCompanyProfiles } from "../src/server/analysis/companyComparison";
import { buildCompanyProfileFromTianyan, buildCompanyProfilesFromRecords } from "../src/server/analysis/companyProfile";
import { POST as comparePost } from "../src/app/api/market-intelligence/company-comparison/route";
import { GET as profilesGet, POST as profilesPost } from "../src/app/api/market-intelligence/company-profiles/route";

test("企业画像清洗保留来源边界并从经营范围提取场景信号", () => {
  const profile = buildCompanyProfileFromTianyan({
    companyName: " 北京示例机器人科技有限公司 ",
    registration: {
      status: "存续",
      registeredCapital: "1000万人民币",
      location: "北京市海淀区",
      businessScope: "机器人关节模组、工业自动化设备、精密电机研发与销售"
    },
    risk: { summary: "建议人工查看明细" },
    source: "天眼 AI"
  });

  assert.equal(profile.companyName, "北京示例机器人科技有限公司");
  assert.equal(profile.verificationStatus, "待人工核验");
  assert.deepEqual(profile.applicationScenarios, ["人形机器人与灵巧手", "实验室自动化与精密工业设备"]);
  assert.ok(profile.productKeywords.includes("电机"));
  assert.equal(profile.evidenceLinks[0].source, "天眼 AI");
});

test("企业画像批量清洗会合并重复主体和别名", () => {
  const profiles = buildCompanyProfilesFromRecords([
    { companyName: "示例智能", aliases: ["示例"], creditCode: "91110000MA00000001", businessScope: "医疗微泵与机器人产品" },
    { companyName: "示例智能科技有限公司", aliases: ["示例"], creditCode: "91110000MA00000001", businessScope: "无人机云台" }
  ]);

  assert.equal(profiles.length, 1);
  assert.equal(profiles[0].creditCode, "91110000MA00000001");
  assert.ok(profiles[0].aliases.includes("示例"));
  assert.ok(profiles[0].applicationScenarios.includes("医疗机器人与精密医疗设备"));
  assert.ok(profiles[0].applicationScenarios.includes("无人机与航空航天微驱动"));
});

test("企业对比输出优先级和固定维度解释", () => {
  const profiles = buildCompanyProfilesFromRecords([
    { companyName: "机器人优先客户", registrationStatus: "存续", registeredCapital: "5000万", businessScope: "机器人关节、空心杯电机、专利技术、招投标项目" },
    { companyName: "风险客户", registrationStatus: "注销", riskSummary: "经营异常；司法案件", businessScope: "贸易" }
  ]);

  const result = compareCompanyProfiles(profiles);
  assert.equal(result.items.length, 2);
  assert.equal(result.items[0].companyName, "机器人优先客户");
  assert.equal(result.items[0].priority, "优先跟进");
  assert.equal(result.dimensions.length, 7);
  assert.ok(result.items[0].dimensionScores.some((item) => item.dimension === "场景匹配度" && item.score > 0));
});

test("企业画像 API 支持创建画像并按 ID 对比", async () => {
  process.env.DEMO_EPHEMERAL_STORE = "true";
  const create = await profilesPost(new Request("http://localhost/api/market-intelligence/company-profiles", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      records: [
        { companyName: "优先机器人", creditCode: "api-001", businessScope: "机器人关节、空心杯电机、招投标项目" },
        { companyName: "医疗微泵", creditCode: "api-002", businessScope: "医疗微泵、精密检测设备、专利研发" }
      ]
    })
  }));
  assert.equal(create.status, 200);
  const created = await create.json() as { profiles: Array<{ id: string }> };
  assert.equal(created.profiles.length, 2);

  const list = await profilesGet();
  assert.equal(list.status, 200);
  const comparison = await comparePost(new Request("http://localhost/api/market-intelligence/company-comparison", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ profileIds: created.profiles.map((profile) => profile.id) })
  }));
  assert.equal(comparison.status, 200);
  assert.equal((await comparison.json()).result.items.length, 2);
});
