import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LearningReviewWorkbench } from "../src/components/agent/LearningReviewWorkbench";

Object.assign(globalThis, { React });

test("learning workbench sidebar exposes only the two core modules under history", () => {
  const html = renderToStaticMarkup(<LearningReviewWorkbench />);

  assert.match(html, /学习记录/);
  assert.match(html, /销售培训/);
  assert.match(html, /模拟客户/);
  assert.match(html, /class="learning-history-tabs"/);
  assert.doesNotMatch(html, /class="learning-direction-row"/);
  assert.doesNotMatch(html, /class="learning-module-tabs"/);
  assert.doesNotMatch(html, /整合产品学习与营销话术训练/);
  assert.doesNotMatch(html, /导入企业情报后进行客户沟通演练/);
});

test("simulated customer module exposes a scoring entry and feedback dialog", () => {
  const html = renderToStaticMarkup(<LearningReviewWorkbench initialQuery={{ module: "customer" }} />);

  assert.match(html, /评分/);
  assert.match(html, /对话评分/);
  assert.match(html, /训练反馈/);
});
