import assert from "node:assert/strict";
import test from "node:test";
import { buildKnowledgeContext } from "@/server/learning/answerSalesLearningQuestion";

test("buildKnowledgeContext prepares matching knowledge for private model context", () => {
  const context = buildKnowledgeContext("客户说价格高怎么办？", [{ title: "价格异议处理 SOP", content: "先确认工况，再解释总拥有成本。" }]);
  assert.match(context, /价格异议处理 SOP/);
  assert.match(context, /总拥有成本/);
});
