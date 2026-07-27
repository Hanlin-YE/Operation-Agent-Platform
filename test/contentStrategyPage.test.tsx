import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ContentStrategyWorkbench } from "../src/components/content/ContentStrategyWorkbench";

Object.assign(globalThis, { React });

test("content strategy page focuses on URL video analysis without the legacy strategy workflow", () => {
  const html = renderToStaticMarkup(<ContentStrategyWorkbench />);

  assert.match(html, /公开视频 URL/);
  assert.match(html, /开始拆解/);
  assert.match(html, /inputMode="url"/);
  assert.doesNotMatch(html, /type="url"/);
  assert.doesNotMatch(html, /样本档案/);
  assert.doesNotMatch(html, /证据画布/);
  assert.doesNotMatch(html, /审核与交接/);
  assert.doesNotMatch(html, /生成策略包/);
});
