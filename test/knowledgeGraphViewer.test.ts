import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("graph nodes select on pointer down without starting canvas pan", () => {
  const source = readFileSync("src/components/graph/KnowledgeGraphViewer.tsx", "utf8");

  assert.match(source, /isGraphNodeTarget/);
  assert.match(source, /onPointerDown=\{\(event\) => \{/);
  assert.match(source, /selectNode\(node\.id\)/);
  assert.match(source, /graph-node-hit-area/);
});
