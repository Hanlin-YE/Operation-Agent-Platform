import assert from "node:assert/strict";
import test from "node:test";
import { checkPitchCompliance } from "@/lib/sales/pitchCompliance";
import { getDailyWork } from "@/lib/sales/dailyWork";
import { readData } from "@/server/data/store";
import { createLead, getLead } from "@/server/repositories/leads";
import { POST as generatePitch } from "@/app/api/agent/generate-pitch/route";
import { PATCH as editLead } from "@/app/api/leads/[id]/route";
import { PATCH as editPitch } from "@/app/api/pitches/[id]/route";
import { POST as createFollowUp, PATCH as completeFollowUp } from "@/app/api/follow-ups/route";
import { FollowUp } from "@/server/data/types";

process.env.DEMO_EPHEMERAL_STORE = "true";

function request(body: unknown) {
  return new Request("http://localhost/api", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
}

for (const text of ["保证性能达标", "寿命10万小时", "效率提升30%", "扭矩为20N·m", "精度±0.01mm", "两天交付", "１００％达标", "guaranteed lifetime of 5 years", "guarantee delivery", "功率达到200", "转速为3000rpm", "效率达到百分之九十", "lifetime: 5 years"]) {
  test(`blocks a performance or delivery claim: ${text}`, () => assert.ok(checkPitchCompliance(text).length));
}

test("allows requirements gathering without a numerical commitment", () => {
  assert.deepEqual(checkPitchCompliance("请确认目标精度、负载及运行方式，具体性能以技术验证和书面确认为准。"), []);
});

test("editing a lead persists fields, re-derives routing and protects identity", async () => {
  const lead = await createLead({ companyName: "编辑前公司", tags: ["原标签"] });
  const response = await editLead(request({ companyName: " 编辑后公司 ", contactName: "王工", contactMethod: "sales@example.com", tags: "机器人，样机,机器人", notes: "确认需求", id: "forged", createdAt: "forged", accountTier: "forged" }), { params: { id: lead.id } });
  assert.equal(response.status, 200);
  const saved = (await getLead(lead.id))!;
  assert.equal(saved.companyName, "编辑后公司");
  assert.equal(saved.contactMethod, "sales@example.com");
  assert.deepEqual(saved.tags, ["机器人", "样机"]);
  assert.equal(saved.id, lead.id);
  assert.equal(saved.createdAt, lead.createdAt);
  assert.notEqual(saved.accountTier, "forged");
  assert.equal(saved.industry, lead.industry);
  assert.equal((await editLead(request({ companyName: " " }), { params: { id: lead.id } })).status, 400);
  assert.equal((await editLead(request({ tags: [5] }), { params: { id: lead.id } })).status, 400);
  assert.equal((await editLead(request({ notes: "test" }), { params: { id: "missing" } })).status, 404);
});

test("safe generated and edited pitches persist; follow-up uses the edited text and correct lead", async () => {
  const oldKey = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  try {
    const lead = await createLead({ companyName: "话术流程公司" });
    const generated = await generatePitch(request({ leadId: lead.id, channel: "email" }));
    assert.equal(generated.status, 200);
    const pitch = await generated.json();
    assert.match(pitch.rationale, /本地询问模板/);
    const content = "王工您好，请先确认工况与目标负载，再安排技术验证。";
    const edited = await editPitch(request({ content }), { params: { id: pitch.id } });
    assert.equal(edited.status, 200);
    assert.ok((await edited.json()).updatedAt);
    const badEdit = await editPitch(request({ content: "保证寿命10万小时" }), { params: { id: pitch.id } });
    assert.equal(badEdit.status, 422);
    assert.equal((await readData()).pitches.find((item) => item.id === pitch.id)?.content, content);
    const unsafeFollowUp = await createFollowUp(request({ leadId: lead.id, pitchId: pitch.id, content: "确保效率提高30%" }));
    assert.equal(unsafeFollowUp.status, 422);
    const unrelated = await createLead({ companyName: "其他公司" });
    assert.equal((await createFollowUp(request({ leadId: unrelated.id, pitchId: pitch.id, content }))).status, 400);
    const followed = await createFollowUp(request({ leadId: lead.id, pitchId: pitch.id, type: "email", content, nextActionAt: "2026-11-18T15:30" }));
    assert.equal(followed.status, 201);
    const task = await followed.json();
    assert.equal(task.content, content);
    assert.equal(task.nextActionAt, "2026-11-18T07:30:00.000Z");
    assert.equal((await completeFollowUp(request({ id: task.id, status: "done" }))).status, 200);
    assert.equal((await readData()).followUps.find((item) => item.id === task.id)?.status, "done");
    assert.equal((await createFollowUp(request({ leadId: lead.id, content, nextActionAt: "invalid" }))).status, 400);
  } finally {
    if (oldKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = oldKey;
  }
});

test("unsafe model output is rejected before it can be saved and safety instructions are included", async () => {
  const oldFetch = globalThis.fetch;
  const oldKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "test-only";
  let system = "";
  globalThis.fetch = async (_input, init) => {
    system = JSON.parse(init?.body as string).messages[0].content;
    return Response.json({ choices: [{ message: { content: "保证精度0.01mm，寿命10万小时。" } }] });
  };
  try {
    const lead = await createLead({ companyName: "模型输出拦截公司" });
    const before = (await readData()).pitches.length;
    const response = await generatePitch(request({ leadId: lead.id, channel: "phone" }));
    assert.equal(response.status, 422);
    assert.match(system, /不得向客户承诺性能参数/);
    assert.equal((await readData()).pitches.length, before);
  } finally {
    globalThis.fetch = oldFetch;
    if (oldKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = oldKey;
  }
});

test("daily queue includes overdue and all of today's tasks in Shanghai time, omitting completed and invalid leads", async () => {
  const lead = await createLead({ companyName: "每日任务公司", status: "to_follow" });
  const invalid = await createLead({ companyName: "无效公司", status: "invalid" });
  const task = (id: string, nextActionAt?: string, extra: Partial<FollowUp> = {}): FollowUp => ({ id, leadId: lead.id, type: "call", content: "确认工况", status: "open", createdAt: "2026-11-01T00:00:00Z", nextActionAt, ...extra });
  const tasks = [task("overdue", "2026-11-17T23:59"), task("today", "2026-11-18T23:59"), task("tomorrow", "2026-11-18T16:00:00Z"), task("utc-today", "2026-11-17T16:00:00Z"), task("undated"), task("bad-date", "invalid"), task("done", undefined, { status: "done" }), task("invalid", undefined, { leadId: invalid.id }), task("orphan", undefined, { leadId: "missing" })];
  const queue = getDailyWork([lead, invalid], tasks, new Date("2026-11-18T04:00:00Z"));
  assert.deepEqual(queue.overdue.map(({ task }) => task.id), ["overdue"]);
  assert.deepEqual(queue.today.map(({ task }) => task.id), ["utc-today", "today"]);
  assert.deepEqual(queue.unscheduled.map(({ task }) => task.id), ["undated", "bad-date"]);
  assert.deepEqual(queue.unplannedLeads, []);
  assert.equal(getDailyWork([lead], [], new Date("2026-11-18")).unplannedLeads[0].id, lead.id);
});

test("local file saves survive a fresh process without touching the repository data", async () => {
  const { mkdtemp, rm } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { pathToFileURL } = await import("node:url");
  const { spawnSync } = await import("node:child_process");
  const root = process.cwd();
  const directory = await mkdtemp(join(tmpdir(), "sales-persistence-"));
  const leadModule = pathToFileURL(join(root, "src/server/repositories/leads.ts")).href;
  const artifactsModule = pathToFileURL(join(root, "src/server/repositories/salesArtifacts.ts")).href;
  const loader = pathToFileURL(join(root, "node_modules/tsx/dist/loader.mjs")).href;
  const run = (code: string) => spawnSync(process.execPath, ["--import", loader, "--input-type=module", "-e", code], {
    cwd: directory, encoding: "utf8", env: { ...process.env, DEMO_EPHEMERAL_STORE: "false", CLOUDFLARE: "false", TSX_TSCONFIG_PATH: join(root, "tsconfig.json") }
  });
  try {
    const first = run(`
      const { createLead, updateLead } = await import(${JSON.stringify(leadModule)});
      const { savePitch, updatePitchContent, saveFollowUp } = await import(${JSON.stringify(artifactsModule)});
      const lead = await createLead({ companyName: '本地持久化测试' });
      await updateLead(lead.id, { contactName: '重启后仍在' });
      const pitch = await savePitch({ leadId: lead.id, channel: 'phone', scenario: '电话', content: '请确认工况。', rationale: 'test', citations: [] });
      await updatePitchContent(pitch.id, '请确认负载后安排技术验证。');
      await saveFollowUp({ leadId: lead.id, pitchId: pitch.id, type: 'call', content: '请确认负载后安排技术验证。', status: 'open' });
      console.log(lead.id);
    `);
    assert.equal(first.status, 0, first.stderr);
    const second = run(`
      const { getLead } = await import(${JSON.stringify(leadModule)});
      const { listPitchesByLead, listFollowUpsByLead } = await import(${JSON.stringify(artifactsModule)});
      const id = ${JSON.stringify(first.stdout.trim())};
      console.log(JSON.stringify({ lead: await getLead(id), pitches: await listPitchesByLead(id), followUps: await listFollowUpsByLead(id) }));
    `);
    assert.equal(second.status, 0, second.stderr);
    const persisted = JSON.parse(second.stdout);
    assert.equal(persisted.lead.contactName, "重启后仍在");
    assert.equal(persisted.pitches[0].content, "请确认负载后安排技术验证。");
    assert.equal(persisted.followUps[0].content, persisted.pitches[0].content);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
