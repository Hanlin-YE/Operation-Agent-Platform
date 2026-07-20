import assert from "node:assert/strict";
import test from "node:test";
import { answerSalesLearningQuestion } from "@/server/learning/answerSalesLearningQuestion";

test("answerSalesLearningQuestion grounds a review answer in matching knowledge", () => {
  const answer = answerSalesLearningQuestion("客户说价格高怎么办？", [{ title: "价格异议处理 SOP", content: "先确认工况，再解释总拥有成本。" }]);
  assert.match(answer, /价格异议处理 SOP/);
  assert.match(answer, /总拥有成本/);
});
