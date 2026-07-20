import assert from "node:assert/strict";
import test from "node:test";
import { filterLeads } from "@/server/repositories/leads";
import { Lead } from "@/server/data/types";

const leads: Lead[] = [
  {
    id: "lead-1", companyName: "深圳灵巧手科技", industry: "人形机器人", region: "深圳", companySize: "200人",
    contactName: "李工", contactTitle: "研发总监", contactMethod: "test@example.com", source: "展会", status: "to_follow",
    tags: ["灵巧手", "样品"], accountTier: "LA", routingPolicy: "HUMAN_APPROVAL", tierReason: "本地 B2B", notes: "关注寿命", createdAt: "2026-07-01", updatedAt: "2026-07-02"
  },
  {
    id: "lead-2", companyName: "上海医疗设备", industry: "医疗", region: "上海", companySize: "500人",
    contactName: "王总", contactTitle: "采购", contactMethod: "test2@example.com", source: "官网", status: "interested",
    tags: ["医疗"], accountTier: "KA", routingPolicy: "HUMAN_REQUIRED", tierReason: "战略客户", notes: "预约技术交流", createdAt: "2026-07-01", updatedAt: "2026-07-03"
  }
];

test("filterLeads combines keyword, status, and account tier filters", () => {
  const result = filterLeads(leads, { query: "灵巧手 李工", status: "to_follow", accountTier: "LA" });

  assert.deepEqual(result.map((lead) => lead.id), ["lead-1"]);
});

test("filterLeads treats empty filters as all leads", () => {
  assert.deepEqual(filterLeads(leads, {}).map((lead) => lead.id), ["lead-1", "lead-2"]);
});
