# AIGC 产物 → AssetReference 自动注册（桥接）

- **日期**：2026-07-20
- **范围**：内容运营中心 `Operation-Agent-Platform`
- **目标**：打通 AIGC 工作台产出物与内容运营资产引用登记，消除当前"用户手动复制 URL、切到内容运营页、逐条登记 AssetReference"的 6+ 步手工流程
- **非目标**：不自动创建 VideoVersion；不接入 RunningHub 之外的平台；不改变资产"只引用不存储"原则；不引入前端测试体系

---

## 1. 背景与现状

### 1.1 已有事实

- AIGC 模块（`src/server/aigc/`）：Job 走 `draft → awaiting_approval → submitted → running → succeeded` 状态机，完成后 `result.outputs: {url, outputType}[]` 是可访问 URL 列表
- 用户当前操作路径（6 步全手工）：
  1. `/aigc` 页面提交任务、审批资产、等 `succeeded`
  2. 点 outputs 链接打开远端、手动复制 URL
  3. 导航到内容运营 `/content` 页
  4. 选择或创建 ContentSeries
  5. 创建 VideoVersion 手填 durationMs、versionNumber
  6. 手填 AssetReference 粘贴 URL、写 summary
- content-operations 仓储 `addAssetReference` 已定义（`repository.ts:430`）但 **未通过 HTTP API 暴露**，也没有对应 MCP 工具
- 两个模块零交叉引用，是工程空白

### 1.2 用户决策（brainstorming 已确认）

1. **入口位置**：内容运营工作台发起（拉取式），AIGC 模块零改动
2. **映射粒度**：一个 Job = 多条 AssetReference（追加到已有 Version，不自动创建 Version）
3. **类型映射**：规则预填 + 用户可改
4. **多 outputs**：可勾多条批量注册
5. **整体方案**：方案 A —— 新增批量原子路由 + 单弹窗完成

---

## 2. 架构

```
┌─────────────────────────────────┐
│ ContentPublishingWorkbench       │
│  「从 AIGC 导入资产」按钮         │
│         │ 弹窗                   │
│         ▼                        │
│  ┌──────────────────────────┐    │
│  │ 1. 选系列(下拉)          │    │
│  │ 2. 选 Version(下拉)      │    │
│  │ 3. 选 AIGC Job(下拉)     │    │
│  │ 4. 勾 outputs + 编辑字段 │    │
│  │ 5. 批量提交              │    │
│  └──────────────────────────┘    │
└─────────────┬───────────────────┘
              │
   GET /api/aigc/jobs?status=succeeded  (列_job)
              │
              ▼
┌─────────────────────────────────────────┐
│ POST /api/content-operations/assets     │
│  { videoVersionId, assets: Draft[] }    │
│         │                                │
│         ▼                                │
│ bulkAddAssetReferences                   │
│  (mutateContentOperationsData 串行队列) │
│         │                                │
│   原子写入：任一失败全回滚                │
└─────────────────────────────────────────┘
```

---

## 3. API 端点

### 3.1 新增 `POST /api/content-operations/assets`

- 文件：`src/app/api/content-operations/assets/route.ts`（新建）
- 请求体（Zod schema）：

```ts
{
  videoVersionId: string,            // 非空字符串
  assets: Array<{                    // 1..20 条
    assetType: "script" | "storyboard" | "prompt" | "video",
    assetVersion: string,            // 1..64 字符
    referenceUrl: string,            // http(s) URL，≤2048，无嵌入凭证
    summary: string,                  // 1..200 字符
  }>
}
```

- 行为：调用 `bulkAddAssetReferences(videoVersionId, drafts)`
- 成功响应：`201 { accepted: true, createdIds: string[], assets: AssetReference[] }`
- 错误：沿用 `_shared.ts` 的 `contentOperationsError`
  - `not_found`（video_version_not_found）→ 404
  - `validation`（batch_size_invalid / duplicate_in_batch / 字段越界 / URL 凭证）→ 422
  - `conflict`（duplicate_asset_reference 与既有数据冲突）→ 409
  - JSON 体非法 → 400

### 3.2 不新增端点

- 不暴露单条 `POST .../assets/[id]`，YAGNI——批量端点覆盖所有用途
- 不改 `registerVideoVersion`，保持单一职责

---

## 4. 仓储层

### 4.1 新增方法

**文件**：`src/server/content-operations/repository.ts`

```ts
function bulkAddAssetReferences(
  videoVersionId: string,
  drafts: AssetReferenceDraft[]
): AssetReference[]
```

### 4.2 实现约束

- 在 `mutateContentOperationsData((data) => {...})` 串行队列内一次完成
- 前置校验（任一失败抛错，不写入任何资产）：
  1. `videoVersionId` 对应的 VideoVersion 必须存在 → 否则 `not_found/video_version_not_found`
  2. `drafts.length` ∈ [1, 20] → 否则 `validation/batch_size_invalid`
  3. 逐条字段校验：assetType 枚举、assetVersion 1..64、referenceUrl http(s) 且无嵌入凭证、summary 1..200 → 否则 `validation/<具体字段>`
  4. 批内去重：同 `(assetType, assetVersion)` 出现两次 → `validation/duplicate_in_batch`
  5. 与既有数据冲突：`data.assetReferences` 中该 version 已有同 `(assetType, assetVersion)` → `conflict/duplicate_asset_reference`
- 成功：`buildAssetReference` 生成 id（`asset_${uuid}`）与 timestamps，append 到 `data.assetReferences`，更新 `data.videoVersions` 中该 version 的 `updatedAt`
- 返回：本次创建的 `AssetReference[]`，顺序与入参一致

### 4.3 与现有 `addAssetReference` 的关系

- 保留单条方法不变（MCP 内部仍可调用），本次**不改动 `addAssetReference`**
- 抽出内部 helper `validateAssetDraft(data, versionId, draft, seenInBatch?)`，本次仅 `bulkAddAssetReferences` 使用（避免双重排队死锁）；未来如需可让 `addAssetReference` 也复用，但属后续重构，不在本范围
- **`bulkAddAssetReferences` 不调用 `addAssetReference`**——避免 mutation 嵌套导致双重排队死锁

---

## 5. 前端弹窗

### 5.1 入口

**文件**：`src/components/content/ContentPublishingWorkbench.tsx`

- 在现有"登记视频版本"按钮旁加"从 AIGC 导入资产"按钮
- 点击打开模态（沿用现有登记对话框的样式与交互模式）

### 5.2 弹窗结构（单屏，不分步）

```
┌─ 从 AIGC 导入资产 ─────────────────────┐
│ 系列：[下拉 ▾]                          │
│ 版本：[下拉 ▾ 该系列下的所有 Version]   │
│ AIGC 任务：[下拉 ▾ succeeded 列表]      │
│                                          │
│ 该任务的输出物：                         │
│ ☐ video · https://...（截断）            │
│   assetType: [video▾]  assetVersion: ...│
│   summary: [_____________]               │
│ ☐ preview-link · https://...            │
│   ...                                    │
│                                          │
│ [取消]            [注册 N 条资产]       │
└────────────────────────────────────────┘
```

### 5.3 字段默认值与预填规则

- `assetType`：
  - `outputType` 含 `video` → `video`
  - `outputType` 含 `image` → `storyboard`
  - `outputType` 含 `preview` → `video`
  - 其它 → `video`
- `assetVersion`：默认填 `jobId`，可改
- `summary`：默认填 `${projectTitle} - ${outputType}`，可改（前端超 200 字符禁提交并提示）

### 5.4 取数与错误

- 进弹窗调 `GET /api/aigc/jobs?status=succeeded`
  - 若 AIGC API 返回设计中无 `status` 过滤参数，则客户端拿 `GET /api/aigc/jobs` 全量后客户端过滤 `status==="succeeded"`
  - 失败：弹窗内显示"无法获取 AIGC 任务列表"，禁用提交
  - 无数据：弹窗内显示"暂无已完成的 AIGC 任务"
- 提交调 `POST /api/content-operations/assets`
  - 成功：toast"已注册 N 条资产" + 关弹窗 + 触发父组件 `onCatalogRefresh`（复用现有回调）
  - 失败：保留输入、显示后端错误消息

### 5.5 公共客户端扩展

**文件**：`src/components/content/contentOperationsClient.ts`

- 新增 `bulkAddAssetReferences(videoVersionId, drafts)` 调用上述 API
- 新增 AIGC jobs 拉取（如 `contentOperationsClient` 不应跨域 AIGC，则把该 fetch 放在弹窗组件内部）
- 新增 `AssetReferenceDraft` 客户端类型

---

## 6. 测试策略

### 6.1 仓储（追加到 `test/contentOperationsRepository.test.ts`）

- 成功批量注册 2 条，返回顺序与入参一致
- Version 不存在 → `not_found/video_version_not_found`
- `drafts.length === 0` → `validation/batch_size_invalid`
- `drafts.length === 21` → `validation/batch_size_invalid`
- 批内两条 `(video, v1)` 重复 → `validation/duplicate_in_batch`
- 既有 `addAssetReference` 创建后，再用 bulk 加同 `(assetType, assetVersion)` → `conflict/duplicate_asset_reference`
- URL 含嵌入凭证（`https://user:pass@host`）→ `validation`
- summary 201 字符 → `validation`
- 任一失败时不写入任何资产（断言 data.assetReferences 长度不变）

### 6.2 API（新增 `test/contentOperationsAssetsApi.test.ts`）

- 成功 201 + `createdIds` 数量正确 + `assets` 字段完整
- Version 不存在 → 404 + error.kind=`not_found`
- 批内重复 → 422 + `duplicate_in_batch`
- 既有冲突 → 409 + `duplicate_asset_reference`
- 21 条 → 422
- 空数组 → 422
- JSON 体非法 → 400
- `videoVersionId` 缺失 → 422

### 6.3 不写

- 前端组件无测试（维持项目现有约定）
- performance.ts 未触及

---

## 7. 数据流

1. 用户在 ContentPublishingWorkbench 点"从 AIGC 导入资产"
2. 弹窗挂载时调 `GET /api/aigc/jobs`
3. 用户选系列→版本→Job→勾 outputs→编辑预填字段
4. 点"注册 N 条资产" → 前端构造 `AssetReferenceDraft[]`
5. 调 `POST /api/content-operations/assets`
6. 服务端 `bulkAddAssetReferences` 在串行队列内原子写入
7. 成功返回 `{accepted, createdIds, assets}`
8. 前端 toast + 关弹窗 + `onCatalogRefresh` → 发布记录页更新
9. 失败：前端保留输入、显示 `error.message`

---

## 8. 边界与约束

- **不存原始资产**：AssetReference 仅记 referenceUrl，不下载内容（保持设计原则）
- **不修改 Version 状态**：追加资产不改变 Version 的 draft/published/archived
- **assetVersion 默认 jobId**：重复导入同 Job 会因 `(assetType, assetVersion)` 唯一冲突报 409，用户改 assetVersion 即可
- **批量大小 20**：上限足以覆盖典型 AIGC Job 的 outputs 数（mock 1 条，real 通常 ≤ 10 条）
- **无端点级幂等键**：每次提交视为新一批，依赖 Version 内 `(assetType, assetVersion)` 唯一约束防重

---

## 9. 实施清单

### 新增文件
1. `src/app/api/content-operations/assets/route.ts`
2. `test/contentOperationsAssetsApi.test.ts`

### 修改文件
1. `src/server/content-operations/repository.ts` — 新增 `bulkAddAssetReferences`、抽出 `validateAssetDraft`
2. `src/components/content/ContentPublishingWorkbench.tsx` — 加按钮与导入弹窗
3. `src/components/content/contentOperationsClient.ts` — 加客户端方法与类型
4. `test/contentOperationsRepository.test.ts` — 追加 bulk 用例

### 不改动
- AIGC 模块任何文件
- content-operations 现有 API 路由
- `addAssetReference` 单条方法
- MCP server（如需后续桥接 MCP 工具另开任务）

---

## 10. 验收标准

- `npm run typecheck` 通过
- `npm run test:content` 通过所有用例，包括新增的 bulk 与 API 测试
- `npm run build` 通过
- 手动验收：在 dev 启动下，AIGC 工作台跑一个 succeeded Job，切到 `/content`，点"从 AIGC 导入资产"，完成批量登记，发布记录页能看到新资产