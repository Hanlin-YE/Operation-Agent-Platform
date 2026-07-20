import assert from "node:assert/strict";
import test from "node:test";
import { isKnowledgeType } from "@/server/repositories/knowledge";

test("isKnowledgeType only accepts the supported knowledge categories", () => {
  assert.equal(isKnowledgeType("product"), true);
  assert.equal(isKnowledgeType("selection"), true);
  assert.equal(isKnowledgeType("unsupported"), false);
});
