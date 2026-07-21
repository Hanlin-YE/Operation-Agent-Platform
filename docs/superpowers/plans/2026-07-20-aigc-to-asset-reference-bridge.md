# AIGC 产物 → AssetReference 自动注册（桥接）实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 打通 AIGC 工作台已成功任务的输出物与内容运营资产引用登记，把当前 6+ 步手工流程压缩为单弹窗批量导入。

**Architecture:** 在内容运营仓储新增 `bulkAddAssetReferences` 串行原子方法、新增 `POST /api/content-operations/assets` 批量路由、在 `ContentPublishingWorkbench` 加"从 AIGC 导入资产"弹窗。AIGC 模块零改动。

**Tech Stack:** Next.js Route Handlers、Zod v4、node:test、crypto.randomUUID、structuredClone。

**spec:** `docs/superpowers/specs/2026-07-20-aigc-to-asset-reference-bridge-design.md`

---

## 文件清单

### 新增文件
1. `src/app/api/content-operations/assets/route.ts` — 批量登记资产引用路由
2. `test/contentOperationsAssetsApi.test.ts` — API 路由边界测试

### 修改文件
1. `src/server/content-operations/repository.ts` — 新增 `bulkAddAssetReferences`、内部 helper `validateAssetDraft`、`BULK_ASSET_LIMIT` 常量
2. `src/components/content/contentOperationsClient.ts` — 新增 `bulkAddAssetReferences` 客户端方法、`AssetReferenceDraft` 类型
3. `src/components/content/ContentPublishingWorkbench.tsx` — 新增"从 AIGC 导入资产"按钮与弹窗
4. `test/contentOperationsRepository.test.ts` — 追加 `bulkAddAssetReferences` 用例

### 不改动
- AIGC 模块任何文件
- content-operations 现有 API 路由
- `addAssetReference` 单条方法（本次仅复用其校验语义，不重构其调用关系）
- MCP server

---

## Task 1: 仓储层 `bulkAddAssetReferences`

**Files:**
- Modify: `src/server/content-operations/repository.ts`
- Test: `test/contentOperationsRepository.test.ts`

- [ ] **Step 1.1: 在测试文件追加先失败的仓储测试**

在 `test/contentOperationsRepository.test.ts` 末尾追加（保留文件末尾的换行）：

```ts
test("bulkAddAssetReferences 成功批量登记多条资产，按入参顺序返回", async () => {
  const { series, version } = await createSeriesWithVersion();
  const created = await bulkAddAssetReferences(version.id, [
    { assetType: "video", assetVersion: "release-1", referenceUrl: "https://example.com/a.mp4", summary: "首版视频" },
    { assetType: "storyboard", assetVersion: "draft-1", referenceUrl: "https://example.com/b.png", summary: "分镜图" }
  ]);
  assert.equal(created.length, 2);
  assert.equal(created[0].assetType, "video");
  assert.equal(created[1].assetType, "storyboard");
  const all = await readContentOperationsData();
  const stored = all.assetReferences.filter((item) => item.videoVersionId === version.id);
  assert.equal(stored.length, 3); // createSeriesWithVersion 不创建资产；这里两条
});

test("bulkAddAssetReferences Version 不存在返回 not_found/version_not_found", async () => {
  await expectRepositoryError(
    bulkAddAssetReferences("version_does_not_exist", [
      { assetType: "video", assetVersion: "v1", referenceUrl: "https://example.com/a.mp4", summary: "foo" }
    ]),
    "version_not_found"
  );
});

test("bulkAddAssetReferences 空数组与超 20 条返回 batch_size_invalid", async () => {
  const { version } = await createSeriesWithVersion();
  await expectRepositoryError(
    bulkAddAssetReferences(version.id, []),
    "batch_size_invalid"
  );
  const many = Array.from({ length: 21 }, (_, i) => ({
    assetType: "video" as const,
    assetVersion: `v${i}`,
    referenceUrl: `https://example.com/${i}.mp4`,
    summary: `s${i}`
  }));
  await expectRepositoryError(
    bulkAddAssetReferences(version.id, many),
    "batch_size_invalid"
  );
});

test("bulkAddAssetReferences 批量内两条 (assetType, assetVersion) 重复返回 duplicate_in_batch", async () => {
  const { version } = await createSeriesWithVersion();
  await expectRepositoryError(
    bulkAddAssetReferences(version.id, [
      { assetType: "video", assetVersion: "v1", referenceUrl: "https://example.com/a.mp4", summary: "a" },
      { assetType: "video", assetVersion: "V1", referenceUrl: "https://example.com/b.mp4", summary: "b" }
    ]),
    "duplicate_in_batch"
  );
});

test("bulkAddAssetReferences 与既有 (assetType, assetVersion) 冲突返回 duplicate_asset_reference", async () => {
  const { version } = await createSeriesWithVersion();
  await bulkAddAssetReferences(version.id, [
    { assetType: "video", assetVersion: "v1", referenceUrl: "https://example.com/a.mp4", summary: "a" }
  ]);
  await expectRepositoryError(
    bulkAddAssetReferences(version.id, [
      { assetType: "video", assetVersion: "v1", referenceUrl: "https://example.com/b.mp4", summary: "b" }
    ]),
    "duplicate_asset_reference"
  );
});

test("bulkAddAssetReferences URL 含嵌入凭证返回 invalid_referenceUrl", async () => {
  const { version } = await createSeriesWithVersion();
  await expectRepositoryError(
    bulkAddAssetReferences(version.id, [
      { assetType: "video", assetVersion: "v1", referenceUrl: "https://user:pass@example.com/a.mp4", summary: "a" }
    ]),
    "invalid_referenceUrl"
  );
});

test("bulkAddAssetReferences 任一校验失败时不写入任何资产", async () => {
  const { version } = await createSeriesWithVersion();
  const before = (await readContentOperationsData()).assetReferences.length;
  await assert.rejects(
    bulkAddAssetReferences(version.id, [
      { assetType: "video", assetVersion: "v1", referenceUrl: "https://example.com/a.mp4", summary: "a" },
      { assetType: "video", assetVersion: "v2", referenceUrl: "https://example.com/b.mp4", summary: "x".repeat(201) }
    ]),
  );
  const after = (await readContentOperationsData()).assetReferences.length;
  assert.equal(after, before, "失败时不应写入任何资产");
});
```

并在文件顶部 import 段加入 `bulkAddAssetReferences`：

```ts
import {
  ContentOperationsRepositoryError,
  appendPlatformMetricSnapshot,
  bulkAddAssetReferences,
  createChannelPublication,
  createContentSeries,
  listViewerEvents,
  listViewerFeedback,
  listVideoVersions,
  recordViewerEvent,
  registerVideoVersion,
  upsertViewerFeedback
} from "@/server/content-operations/repository";
```

- [ ] **Step 1.2: 运行测试确认失败**

Run: `cd upstream/Operation-Agent-Platform && npm run test:content`
Expected: FAIL — `bulkAddAssetReferences` 未导出，import 直接报错或测试报 "is not a function"

- [ ] **Step 1.3: 在 repository.ts 实现方法**

在 `src/server/content-operations/repository.ts` 顶部常量区（第 144 行 `metricKeys` 之后）加：

```ts
export const BULK_ASSET_LIMIT = 20;
```

在 `buildAssetReference` 函数之后（第 254 行后）加内部 helper：

```ts
function validateAssetDraft(
  data: ContentOperationsData,
  videoVersionId: string,
  draft: AssetReferenceDraft,
  seenInBatch: Set<string>,
): AssetReference {
  if (!draft || typeof draft !== "object" || Array.isArray(draft)) {
    repositoryError("validation", "invalid_asset_reference", "asset reference must be a JSON object");
  }
  if (!assetTypes.has(draft.assetType)) {
    repositoryError("validation", "invalid_asset_type", "unsupported asset type");
  }
  const assetVersion = text(draft.assetVersion, "assetVersion", 64);
  const referenceUrl = externalUrl(draft.referenceUrl, "referenceUrl");
  const summary = text(draft.summary, "summary", 200);
  const key = `${draft.assetType}:${assetVersion.toLowerCase()}`;
  if (seenInBatch.has(key)) {
    repositoryError("validation", "duplicate_in_batch", "asset type and version must be unique within the batch");
  }
  if (data.assetReferences.some(
    (item) => item.videoVersionId === videoVersionId
      && item.assetType === draft.assetType
      && item.assetVersion.toLowerCase() === assetVersion.toLowerCase(),
  )) {
    repositoryError("conflict", "duplicate_asset_reference", "asset type and version must be unique per video version");
  }
  seenInBatch.add(key);
  const now = new Date().toISOString();
  return {
    id: makeId("asset"),
    videoVersionId,
    assetType: draft.assetType,
    assetVersion,
    referenceUrl,
    summary,
    createdAt: now,
    updatedAt: now,
  };
}
```

在 `addAssetReference` 之后（第 441 行后）加新方法 `bulkAddAssetReferences`：

```ts
export async function bulkAddAssetReferences(
  videoVersionId: string,
  drafts: AssetReferenceDraft[],
): Promise<AssetReference[]> {
  return mutateContentOperationsData((data) => {
    requireVersion(data, videoVersionId);
    if (!Array.isArray(drafts)) {
      repositoryError("validation", "invalid_assets", "assets must be an array");
    }
    if (drafts.length === 0 || drafts.length > BULK_ASSET_LIMIT) {
      repositoryError("validation", "batch_size_invalid", `assets must contain 1-${BULK_ASSET_LIMIT} entries`);
    }
    const seenInBatch = new Set<string>();
    const created = drafts.map((draft) => validateAssetDraft(data, videoVersionId, draft, seenInBatch));
    const versionIndex = data.videoVersions.findIndex((item) => item.id === videoVersionId);
    if (versionIndex >= 0) {
      data.videoVersions[versionIndex].updatedAt = new Date().toISOString();
    }
    data.assetReferences.push(...created);
    return created;
  });
}
```

> 注意：`assetReferences` 在种子与现有 `appendVersion`/`addAssetReference` 都使用 `unshift`，新方法用 `push` 也能保持按时间顺序在尾部追加（catalog 的 list 已按 updatedAt 过滤而非插入顺序），保持批量登记的顺序可控。

- [ ] **Step 1.4: 运行测试确认通过**

Run: `cd upstream/Operation-Agent-Platform && npm run test:content`
Expected: PASS — 所有仓储用例通过，包括新追加的 7 个用例

- [ ] **Step 1.5: typecheck 校验**

Run: `cd upstream/Operation-Agent-Platform && npm run typecheck`
Expected: PASS — 无类型错误

- [ ] **Step 1.6: 提交**

```bash
cd upstream/Operation-Agent-Platform
git add src/server/content-operations/repository.ts test/contentOperationsRepository.test.ts
git commit -m "feat(content-operations): 新增 bulkAddAssetReferences 批量原子登记方法"
```

---

## Task 2: `POST /api/content-operations/assets` 路由

**Files:**
- Create: `src/app/api/content-operations/assets/route.ts`
- Test: `test/contentOperationsAssetsApi.test.ts`

- [ ] **Step 2.1: 写失败的路由测试**

新建 `test/contentOperationsAssetsApi.test.ts`：

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { POST as postAssets } from "@/app/api/content-operations/assets/route";
import { POST as postSeries } from "@/app/api/content-operations/series/route";
import { registerVideoVersion } from "@/server/content-operations/repository";
import { createContentSeries } from "@/server/content-operations/repository";

process.env.DEMO_EPHEMERAL_STORE = "true";
delete (globalThis as typeof globalThis & { __CONTENT_OPERATIONS_STORE__?: unknown }).__CONTENT_OPERATIONS_STORE__;

let sequence = 0;
function unique(prefix: string) {
  sequence += 1;
  return `${prefix}-${process.pid}-${sequence}`;
}

async function createPublishedVersion() {
  const created = await createContentSeries({
    name: unique("桥接系列"),
    businessGoal: "验证桥接 API。"
  });
  const registered = await registerVideoVersion({
    seriesId: created.series.id,
    versionNumber: "v1",
    durationMs: 60_000,
    status: "published",
    publishedAt: "2026-07-01T00:00:00.000Z"
  });
  return { series: created.series, version: registered.version };
}

function assetBody(videoVersionId: string, assets: Array<Record<string, string>>) {
  return new Request("http://localhost/api/content-operations/assets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ videoVersionId, assets })
  });
}

test("POST /api/content-operations/assets 批量登记成功返回 201 createdIds", async () => {
  const { version } = await createPublishedVersion();
  const response = await postAssets(assetBody(version.id, [
    { assetType: "video", assetVersion: "v1", referenceUrl: "https://example.com/a.mp4", summary: "首版" },
    { assetType: "storyboard", assetVersion: "draft", referenceUrl: "https://example.com/b.png", summary: "分镜" }
  ]));
  const payload = await response.json() as { accepted: boolean; createdIds: string[]; assets: { id: string }[] };

  assert.equal(response.status, 201);
  assert.equal(payload.accepted, true);
  assert.equal(payload.createdIds.length, 2);
  assert.equal(payload.assets.length, 2);
});

test("POST /api/content-operations/assets Version 不存在返回 404 version_not_found", async () => {
  const response = await postAssets(assetBody("missing-version", [
    { assetType: "video", assetVersion: "v1", referenceUrl: "https://example.com/a.mp4", summary: "s" }
  ]));
  const payload = await response.json() as { error: string };

  assert.equal(response.status, 404);
  assert.equal(payload.error, "version_not_found");
});

test("POST /api/content-operations/assets 批内重复返回 422 duplicate_in_batch", async () => {
  const { version } = await createPublishedVersion();
  const response = await postAssets(assetBody(version.id, [
    { assetType: "video", assetVersion: "v1", referenceUrl: "https://example.com/a.mp4", summary: "a" },
    { assetType: "video", assetVersion: "V1", referenceUrl: "https://example.com/b.mp4", summary: "b" }
  ]));
  const payload = await response.json() as { error: string };

  assert.equal(response.status, 422);
  assert.equal(payload.error, "duplicate_in_batch");
});

test("POST /api/content-operations/assets 与既有冲突返回 409 duplicate_asset_reference", async () => {
  const { version } = await createPublishedVersion();
  await postAssets(assetBody(version.id, [
    { assetType: "video", assetVersion: "v1", referenceUrl: "https://example.com/a.mp4", summary: "a" }
  ]));
  const response = await postAssets(assetBody(version.id, [
    { assetType: "video", assetVersion: "v1", referenceUrl: "https://example.com/b.mp4", summary: "b" }
  ]));
  const payload = await response.json() as { error: string };

  assert.equal(response.status, 409);
  assert.equal(payload.error, "duplicate_asset_reference");
});

test("POST /api/content-operations/assets 超 20 条返回 422 batch_size_invalid", async () => {
  const { version } = await createPublishedVersion();
  const many = Array.from({ length: 21 }, (_, i) => ({
    assetType: "video",
    assetVersion: `v${i}`,
    referenceUrl: `https://example.com/${i}.mp4`,
    summary: `s${i}`
  }));
  const response = await postAssets(assetBody(version.id, many));
  const payload = await response.json() as { error: string };

  assert.equal(response.status, 422);
  assert.equal(payload.error, "batch_size_invalid");
});

test("POST /api/content-operations/assets 空数组返回 422 batch_size_invalid", async () => {
  const { version } = await createPublishedVersion();
  const response = await postAssets(assetBody(version.id, []));
  const payload = await response.json() as { error: string };

  assert.equal(response.status, 422);
  assert.equal(payload.error, "batch_size_invalid");
});

test("POST /api/content-operations/assets 非 JSON 返回 400", async () => {
  const response = await postAssets(new Request("http://localhost/api/content-operations/assets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{not json"
  }));
  assert.equal(response.status, 400);
});

test("POST /api/content-operations/assets 缺 videoVersionId 返回 422", async () => {
  const response = await postAssets(new Request("http://localhost/api/content-operations/assets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ assets: [{ assetType: "video", assetVersion: "v1", referenceUrl: "https://example.com/a.mp4", summary: "s" }] })
  }));
  assert.equal(response.status, 422);
});
```

- [ ] **Step 2.2: 运行测试确认失败**

Run: `cd upstream/Operation-Agent-Platform && npm run test:content`
Expected: FAIL — `@/app/api/content-operations/assets/route` 解析不到模块

- [ ] **Step 2.3: 新建路由文件**

创建 `src/app/api/content-operations/assets/route.ts`：

```ts
import { NextResponse } from "next/server";
import {
  AssetReferenceDraft,
  bulkAddAssetReferences,
} from "@/server/content-operations/repository";
import { contentOperationsError, readRequestObject } from "../_shared";

function isAssetDraft(value: unknown): value is AssetReferenceDraft {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const draft = value as Record<string, unknown>;
  const assetType = draft.assetType;
  return (
    typeof assetType === "string"
    && ["script", "storyboard", "prompt", "video"].includes(assetType)
    && typeof draft.assetVersion === "string"
    && typeof draft.referenceUrl === "string"
    && typeof draft.summary === "string"
  );
}

export async function POST(request: Request) {
  try {
    const body = await readRequestObject(request);
    const videoVersionId = body.videoVersionId;
    if (typeof videoVersionId !== "string" || !videoVersionId.trim()) {
      return NextResponse.json(
        { error: "invalid_videoVersionId", message: "videoVersionId must be a non-empty string" },
        { status: 422 },
      );
    }
    const assetsInput = body.assets;
    if (!Array.isArray(assetsInput)) {
      return NextResponse.json(
        { error: "invalid_assets", message: "assets must be an array" },
        { status: 422 },
      );
    }
    for (const item of assetsInput) {
      if (!isAssetDraft(item)) {
        return NextResponse.json(
          { error: "invalid_asset_reference", message: "each asset must contain assetType, assetVersion, referenceUrl, summary" },
          { status: 422 },
        );
      }
    }
    const created = await bulkAddAssetReferences(
      videoVersionId,
      assetsInput as AssetReferenceDraft[],
    );
    return NextResponse.json(
      { accepted: true, createdIds: created.map((item) => item.id), assets: created },
      { status: 201 },
    );
  } catch (error) {
    return contentOperationsError(error);
  }
}
```

- [ ] **Step 2.4: 运行测试确认通过**

Run: `cd upstream/Operation-Agent-Platform && npm run test:content`
Expected: PASS — 所有 8 个新 API 测试通过

- [ ] **Step 2.5: typecheck 校验**

Run: `cd upstream/Operation-Agent-Platform && npm run typecheck`
Expected: PASS

- [ ] **Step 2.6: 提交**

```bash
cd upstream/Operation-Agent-Platform
git add src/app/api/content-operations/assets/route.ts test/contentOperationsAssetsApi.test.ts
git commit -m "feat(content-operations): 新增 POST /api/content-operations/assets 批量登记路由"
```

---

## Task 3: 客户端扩展

**Files:**
- Modify: `src/components/content/contentOperationsClient.ts`

- [ ] **Step 3.1: 新增 `AssetReferenceDraft` 类型与 `bulkAddAssetReferences` 客户端函数**

在 `src/components/content/contentOperationsClient.ts` 末尾追加：

```ts
export type AssetReferenceDraft = {
  assetType: "script" | "storyboard" | "prompt" | "video";
  assetVersion: string;
  referenceUrl: string;
  summary: string;
};

export type BulkAssetResponse = {
  accepted: boolean;
  createdIds: string[];
  assets: AssetReference[];
};

export async function bulkAddAssetReferences(
  videoVersionId: string,
  assets: AssetReferenceDraft[],
): Promise<BulkAssetResponse> {
  return requestJson<BulkAssetResponse>("/api/content-operations/assets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ videoVersionId, assets })
  });
}

export type AigcJobSummary = {
  jobId: string;
  projectTitle: string;
  status: string;
  createdAt: string;
  result?: {
    outputs: { url: string; outputType: string }[];
  };
};

export async function listSucceededAigcJobs(): Promise<AigcJobSummary[]> {
  const response = await fetch("/api/aigc/jobs", { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`无法获取 AIGC 任务列表（${response.status}）`);
  }
  const payload = await response.json() as AigcJobSummary[];
  return Array.isArray(payload) ? payload.filter((job) => job.status === "succeeded") : [];
}

export function inferAssetType(outputType: string): AssetReferenceDraft["assetType"] {
  const lower = (outputType || "").toLowerCase();
  if (lower.includes("image")) return "storyboard";
  return "video";
}
```

- [ ] **Step 3.2: typecheck 校验**

Run: `cd upstream/Operation-Agent-Platform && npm run typecheck`
Expected: PASS

- [ ] **Step 3.3: 提交**

```bash
cd upstream/Operation-Agent-Platform
git add src/components/content/contentOperationsClient.ts
git commit -m "feat(content-client): 新增 bulkAddAssetReferences 客户端方法与 AIGC jobs 拉取"
```

---

## Task 4: ContentPublishingWorkbench 导入弹窗

**Files:**
- Modify: `src/components/content/ContentPublishingWorkbench.tsx`

- [ ] **Step 4.1: 添加新 state 与导入弹窗渲染**

在 `ContentPublishingWorkbench.tsx` 的 import 段（第 17-34 行的 contentOperationsClient 块）末尾追加新导入：

在
```ts
  requestJson,
  toLocalDateTimeInput
} from "@/components/content/contentOperationsClient";
```
后扩展为：

```ts
  requestJson,
  toLocalDateTimeInput,
  bulkAddAssetReferences as bulkAddAssetReferencesClient,
  listSucceededAigcJobs,
  inferAssetType,
  AigcJobSummary,
  AssetReferenceDraft
} from "@/components/content/contentOperationsClient";
```

在 `getVersionId` 的 import 中追加 `getAssetReferenceId`（若已有则跳过）。

在组件 state 段（约 121 行附近 `publicationPublishedAt` 之后）加：

```ts
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importJobs, setImportJobs] = useState<AigcJobSummary[]>([]);
  const [importJobsError, setImportJobsError] = useState("");
  const [importJobsLoading, setImportJobsLoading] = useState(false);
  const [importVersionId, setImportVersionId] = useState("");
  const [importJobId, setImportJobId] = useState("");
  const [importRows, setImportRows] = useState<{ selected: boolean; assetType: AssetReferenceDraft["assetType"]; assetVersion: string; summary: string; url: string; outputType: string }[]>([]);
```

在 `resetVersionForm`（约 179 行）之后加：

```ts
  async function openImportDialog() {
    setError("");
    setNotice("");
    setImportDialogOpen(true);
    setImportJobs([]);
    setImportJobsError("");
    setImportJobsLoading(true);
    setImportJobId("");
    setImportRows([]);
    setImportVersionId((current) => current || getVersionId(catalog.versions[0] || {} as VideoVersion));
    try {
      const jobs = await listSucceededAigcJobs();
      setImportJobs(jobs);
    } catch (reason) {
      setImportJobsError(reason instanceof Error ? reason.message : "无法获取 AIGC 任务列表");
    } finally {
      setImportJobsLoading(false);
    }
  }

  function loadJobOutputs(jobId: string) {
    setImportJobId(jobId);
    const job = importJobs.find((item) => item.jobId === jobId);
    if (!job?.result?.outputs?.length) {
      setImportRows([]);
      return;
    }
    const rows = job.result.outputs.map((output) => ({
      selected: true,
      assetType: inferAssetType(output.outputType),
      assetVersion: job.jobId,
      summary: `${job.projectTitle} - ${output.outputType}`.slice(0, 200),
      url: output.url,
      outputType: output.outputType
    }));
    setImportRows(rows);
  }

  function updateImportRow(index: number, patch: Partial<{ selected: boolean; assetType: AssetReferenceDraft["assetType"]; assetVersion: string; summary: string }>) {
    setImportRows((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  }

  async function submitImport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (!importVersionId) throw new Error("请选择目标视频版本");
      const selected = importRows.filter((row) => row.selected);
      if (!selected.length) throw new Error("请至少勾选一条 AIGC 输出物");
      const drafts: AssetReferenceDraft[] = selected.map((row) => ({
        assetType: row.assetType,
        assetVersion: row.assetVersion.trim(),
        referenceUrl: row.url,
        summary: row.summary.trim().slice(0, 200)
      }));
      const result = await bulkAddAssetReferencesClient(importVersionId, drafts);
      await loadCatalog();
      setImportDialogOpen(false);
      setNotice(`已登记 ${result.createdIds.length} 条 AIGC 资产引用。`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "导入失败");
    } finally {
      setBusy(false);
    }
  }
```

在 `closeOnEscape`（约 142-149 行）的回调中追加 `setImportDialogOpen(false)`：

```ts
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setVersionDialogOpen(false);
        setPublicationDialogOpen(false);
        setImportDialogOpen(false);
      }
    }
```

在页头 `<div className="actions">`（约 322 行）的"绑定渠道"按钮之前插入新按钮：

```tsx
          <button className="button secondary" type="button" onClick={openImportDialog} title="从 AIGC 已完成任务导入资产引用">
            <FileCode2 size={16} />从 AIGC 导入资产
          </button>
```

> `FileCode2` 已在文件顶部的 lucide-react 导入中（第 7 行）。

在 `{publicationDialogOpen ? (...) : null}` 渲染块之后、组件 `</div>` 收尾之前追加导入弹窗 JSX：

```tsx
      {importDialogOpen ? (
        <div className="content-dialog-overlay" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setImportDialogOpen(false)}>
          <section className="content-dialog content-import-dialog" role="dialog" aria-modal="true" aria-labelledby="import-aigc-title">
            <div className="content-dialog-head"><div><p className="eyebrow">Import from AIGC</p><h2 id="import-aigc-title">从 AIGC 导入资产引用</h2></div><button className="icon-button" type="button" onClick={() => setImportDialogOpen(false)} aria-label="关闭导入窗口"><X size={17} /></button></div>
            <form onSubmit={submitImport}>
              <div className="content-dialog-body">
                {error ? <div className="content-notice error" role="alert">{error}</div> : null}
                <label className="field full"><span>目标视频版本</span><select required value={importVersionId} onChange={(event) => setImportVersionId(event.target.value)}>
                  {catalog.versions.length ? catalog.versions.map((version) => {
                    const series = catalog.series.find((item) => getSeriesId(item) === version.seriesId);
                    return <option key={getVersionId(version)} value={getVersionId(version)}>{series?.name || "未知系列"} · {version.versionNumber}</option>;
                  }) : <option value="" disabled>暂无视频版本，请先登记</option>}
                </select></label>
                <label className="field full"><span>AIGC 任务（仅显示已成功）</span>
                  {importJobsLoading ? <div className="content-inline-empty">正在读取 AIGC 任务…</div>
                      : importJobsError ? <div className="content-notice error" role="alert">{importJobsError}</div>
                      : importJobs.length === 0 ? <div className="content-inline-empty"><span>暂无已完成的 AIGC 任务</span></div>
                      : <select value={importJobId} onChange={(event) => loadJobOutputs(event.target.value)}>
                          <option value="">请选择一个 AIGC 任务</option>
                          {importJobs.map((job) => <option key={job.jobId} value={job.jobId}>{job.projectTitle} · {new Date(job.createdAt).toLocaleString("zh-CN")}</option>)}
                        </select>}
                </label>
                {importJobId && importRows.length > 0 ? (
                  <fieldset className="content-form-section"><legend>输出物与字段</legend>
                    <div className="content-form-list">
                      {importRows.map((row, index) => (
                        <div className="content-form-row asset" key={`import-${index}`}>
                          <label className="field compact"><input type="checkbox" checked={row.selected} onChange={(event) => updateImportRow(index, { selected: event.target.checked })} aria-label={`勾选第 ${index + 1} 条输出`} /></label>
                          <label className="field"><span>资产类型</span><select value={row.assetType} onChange={(event) => updateImportRow(index, { assetType: event.target.value as AssetReferenceDraft["assetType"] })}><option value="script">脚本</option><option value="storyboard">分镜</option><option value="prompt">提示词</option><option value="video">视频</option></select></label>
                          <label className="field"><span>资产版本</span><input value={row.assetVersion} onChange={(event) => updateImportRow(index, { assetVersion: event.target.value })} /></label>
                          <label className="field wide"><span>摘要</span><input value={row.summary} maxLength={200} onChange={(event) => updateImportRow(index, { summary: event.target.value })} /></label>
                          <a className="content-import-url-hint" href={row.url} target="_blank" rel="noreferrer" title={`输出类型：${row.outputType}`}>{row.outputType} · 打开</a>
                        </div>
                      ))}
                    </div>
                  </fieldset>
                ) : null}
                {!importJobId && !importJobsLoading && !importJobsError && importJobs.length > 0 ? <p className="content-form-help">选择一个 AIGC 任务以加载其输出物。</p> : null}
              </div>
              <div className="content-dialog-actions"><button className="button secondary" type="button" onClick={() => setImportDialogOpen(false)}>取消</button><button className="button" disabled={busy || !importRows.some((row) => row.selected)}>{busy ? "登记中…" : `登记 ${importRows.filter((row) => row.selected).length} 条资产`}</button></div>
            </form>
          </section>
        </div>
      ) : null}
```

- [ ] **Step 4.2: typecheck 校验**

Run: `cd upstream/Operation-Agent-Platform && npm run typecheck`
Expected: PASS

- [ ] **Step 4.3: 提交**

```bash
cd upstream/Operation-Agent-Platform
git add src/components/content/ContentPublishingWorkbench.tsx
git commit -m "feat(content-ui): 发布记录页新增从 AIGC 导入资产引用弹窗"
```

---

## Task 5: 验收

- [ ] **Step 5.1: typecheck**

Run: `cd upstream/Operation-Agent-Platform && npm run typecheck`
Expected: PASS

- [ ] **Step 5.2: test:content**

Run: `cd upstream/Operation-Agent-Platform && npm run test:content`
Expected: 三个测试文件全部 PASS（包含 repository / performance / mcp / 新 assets api）

- [ ] **Step 5.3: build**

Run: `cd upstream/Operation-Agent-Platform && npm run build`
Expected: PASS — Next.js 编译成功，无类型错误

---

## 自检摘要（spec 对应）

- §3 API 端点 → Task 2 ✓
- §4 仓储层 → Task 1 ✓
- §5 前端弹窗 → Task 4 ✓
- §5.5 公共客户端扩展 → Task 3 ✓
- §6.1 仓储测试 → Task 1.1 覆盖 7 个用例 ✓
- §6.2 API 测试 → Task 2.1 覆盖 8 个用例 ✓
- §9 实施清单 → 与 Task 编号一一对应 ✓
- §10 验收标准 → Task 5 ✓