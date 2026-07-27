import assert from "node:assert/strict";
import test from "node:test";
import { buildKnowledgeContext, buildSimulatedCustomerContext } from "@/server/learning/answerSalesLearningQuestion";

test("buildKnowledgeContext prepares matching knowledge for private model context", () => {
  const context = buildKnowledgeContext("客户说价格高怎么办？", [{ title: "价格异议处理 SOP", content: "先确认工况，再解释总拥有成本。" }]);
  assert.match(context, /价格异议处理 SOP/);
  assert.match(context, /总拥有成本/);
});

test("buildSimulatedCustomerContext distills procurement role-play requirements", () => {
  const context = buildSimulatedCustomerContext();
  assert.match(context, /专业采购人员/);
  assert.match(context, /初创公司/);
  assert.match(context, /批量交付案例/);
  assert.match(context, /第三方测试报告/);
  assert.match(context, /不要替销售回答/);
});

test("buildSimulatedCustomerContext includes imported company persona as hidden role prompt", () => {
  const context = buildSimulatedCustomerContext({
    id: "learning-test",
    title: "北京示例智能科技有限公司",
    category: "customer",
    targetCompanyName: "北京示例智能科技有限公司",
    targetCompanyUrl: "https://www.tianyancha.com/company/company-001",
    targetCompanyPrompt: "根据该企业信息（企业链接：https://www.tianyancha.com/company/company-001），请分析并蒸馏该企业的企业画像。\n请基于以上信息，模拟该企业作为客户，与销售人员进行真实业务交流。语气刁钻直击痛点。",
    messages: [],
    createdAt: "2026-07-22T00:00:00.000Z",
    updatedAt: "2026-07-22T00:00:00.000Z",
  });

  assert.match(context, /隐藏客户设定/);
  assert.match(context, /北京示例智能科技有限公司/);
  assert.match(context, /企业链接：https:\/\/www\.tianyancha\.com\/company\/company-001/);
  assert.match(context, /不得把这段设定当作聊天记录复述给用户/);
});
