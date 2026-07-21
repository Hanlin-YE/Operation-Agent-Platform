# 发布记录工作台改造设计

- **日期**：2026-07-21
- **目标**：把发布记录工作台从"技术资产登记视角"改为"发布台账视角"，按子安指定表头（内容标题、发布时间、发布平台、内容类型、批次、发布人、审批人、状态）展示；让 AIGC 完成产物可"一键登记为发布记录"
- **非目标**：不改性能比较口径；不改已有 dashboard / highlights 输出契约；平台快照批量、新渠道、钉钉审核属其它 Phase
- **用户决策**：在 VideoVersion 上新增字段（粒度 Version，不新增 Publication 概念）

## 数据模型

`VideoVersion` 新增四个可选字段（保持 schemaVersion=1，向后兼容，旧数据视为 null）：

| 字段 | 类型 | 校验 | 默认 |
|---|---|---|---|
| `title` | string \| null | 1..120 字符 | 缺省 fallback `$(series.name) $(versionNumber)` |
| `batch` | string \| null | 1..40 字符 | null |
| `publishedBy` | string \| null | 1..60 字符 | null |
| `approvedBy` | string \| null | 1..60 字符 | null |

## 仓储变更

- `RegisterVideoVersionInput` 新增 `title?/batch?/publishedBy?/approvedBy?`
- `appendVersion` 校验并写入新字段；published 状态不强制 publishedBy（运营可能延迟录入）
- 列出方法 `listVideoVersions` / `getContentOperationsCatalogResponse` 自动包含新字段（structuredClone 已经透传）
- 新增仓储方法 `updatePublicationLedger(versionId, {title?, batch?, publishedBy?, approvedBy?})`：仅这几个字段可单独更新，不动 status/durationMs

## API 变更

- `POST /api/content-operations/versions`：接受新字段（透传到 registerVideoVersion）
- 新增 `PATCH /api/content-operations/versions/[versionId]/ledger`：单独更新 ledger 字段
  - 请求体：`{title?, batch?, publishedBy?, approvedBy?}` 任一非 null 时更新
  - 响应：200 + 更新后的 version
  - Version 不存在 → 404

## 前端表头改造

`ContentPublishingWorkbench` 主表 columns 从：

```
内容系列 / 业务目标 | 版本 | 状态 | 资产/CTA | 渠道 | 发布日期 | 操作
```

改为：

```
内容标题 | 发布时间 | 发布平台 | 内容类型 | 批次 | 发布人 | 审批人 | 状态 | 操作
```

- 内容标题：`version.title || $(series.name) $(version.versionNumber)`
- 发布时间：取 version.publishedAt 或其 publications 中最早 publishedAt，formatDate
- 发布平台：publications 渠道徽章列表（沿用现有 badge 风格）
- 内容类型：固定"视频"（未来渠道扩展为图/文时再改）
- 批次/发布人/审批人：直接显示，缺值显示"—"
- 状态：状态徽章

"登记视频版本"对话框同步加 4 个输入框（标题/批次/发布人/审批人，标题缺省走系列名拼版本号）。

## AIGC 一键登记为发布记录

在 ContentPublishingWorkbench 页头加第二个按钮「从 AIGC 登记发布记录」（区别已有"从 AIGC 导入资产"）。

弹窗字段：
- 系列选择（下拉，可选新建）
- 视频版本号、时长（秒）、状态、发布日期（沿用现有 version dialog 风格）
- 内容标题（默认 `${job.projectTitle} ${versionNumber}`，可改）
- 批次（输入，默认 `batch-$(YYYYMMDD)`按当天）
- 发布人/审批人（输入）
- AIGC 任务下拉（复用 listSucceededAigcJobs）
- outputs 勾选（勾选的填入 assetReferences）

提交：调 `POST /api/content-operations/series`（新建系列带版本）或 `POST /api/content-operations/versions`（已有系列）+ `POST /api/content-operations/assets` 批量登记。

## 测试覆盖

仓储：
- `registerVideoVersion` 带新字段，校验返回包含字段
- 各字段越界（title 121、batch 41、publishedBy/approvedBy 61）→ validation 错误
- `updatePublicationLedger` 成功 + Version 不存在 + 字段越界

API：
- `POST /versions` 带新字段 → 201，返回含新字段
- `PATCH /versions/[id]/ledger` 成功 200
- `PATCH /versions/[id]/ledger` Version 不存在 → 404

前端：smoke 测试归入 Phase B。

## 验收

- typecheck + test:content 通过
- build 通过
- dev 起，发布记录页表头按新 8 列显示，AIGC 一键登记弹窗走通