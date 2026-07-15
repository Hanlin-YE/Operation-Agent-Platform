# 实施优先级与开发路线

更新时间：2026-07-12

## 总目标

用最短路径做出一个可演示、可迭代的电机销售 AIGC Agent：

```text
线索管理 + 潜客评分 + 专业话术生成 + 产品知识库 + 跟进记录
```

架构原则：

- 前后端一体推进，不能后端孤立开发。
- 每个后端能力都必须有对应前端演示入口。
- 先做固定业务流程，再做自由编排。
- 先保证销售场景准确，再扩展营销自动化。
- 所有外部来源和竞品结论先过 review gate，再进入 PRD 和路线图。

## P0：可演示闭环

目标：完成一个销售从录入线索到生成话术的完整流程。

### Step 1：项目骨架

目标：

- 初始化 Next.js + TypeScript 全栈项目。
- 接入 UI 基础组件和数据库。

建议文件：

```text
package.json
prisma/schema.prisma
src/app/layout.tsx
src/app/page.tsx
src/server/db.ts
src/server/env.ts
```

验收：

- 本地能启动 Web。
- 能连接数据库。
- 首页展示销售 Agent Dashboard。

### Step 2：线索数据模型和列表页

目标：

- 建立 Lead 模型。
- 完成线索列表、新建、详情页。

建议文件：

```text
prisma/schema.prisma
src/app/leads/page.tsx
src/app/leads/[id]/page.tsx
src/app/api/leads/route.ts
src/server/repositories/leads.ts
src/components/leads/LeadTable.tsx
src/components/leads/LeadForm.tsx
```

验收：

- 能新增线索。
- 能查看线索列表。
- 能打开线索详情。

### Step 3：电机产品知识库

目标：

- 建立 Product 和 KnowledgeDocument。
- 支持维护产品资料和销售知识。

建议文件：

```text
src/app/products/page.tsx
src/app/knowledge/page.tsx
src/app/api/products/route.ts
src/app/api/knowledge/route.ts
src/server/repositories/products.ts
src/server/repositories/knowledge.ts
```

验收：

- 能录入电机产品。
- 能录入或上传知识文本。
- 话术生成时能读取知识内容。

### Step 4：潜客评分引擎

目标：

- 实现规则评分。
- 实现 AI 辅助评分解释。
- 评分结果保存为 LeadScore。

建议文件：

```text
src/server/scoring/rules.ts
src/server/scoring/scoreLead.ts
src/server/agents/leadScoringAgent.ts
src/app/api/agent/score-lead/route.ts
src/components/scoring/ScoreBreakdown.tsx
```

验收：

- 点击“AI 评分”后生成总分、等级、分项分。
- 展示评分理由和推荐动作。
- 评分结果保存到数据库。

### Step 5：销售话术生成

目标：

- 实现 6 类话术生成。
- 引入产品知识和客户画像。
- 保存 GeneratedPitch。
- 在话术生成前增加 Product Recommendation / Guided Selling 输出。

建议文件：

```text
src/server/agents/pitchGenerationAgent.ts
src/server/llm/provider.ts
src/server/rag/retrieveKnowledge.ts
src/app/api/agent/generate-pitch/route.ts
src/components/agent/PitchGenerator.tsx
src/components/agent/PitchPreview.tsx
```

验收：

- 可选择电话、微信、邮件、报价跟进、价格异议、技术确认。
- 生成内容专业且可编辑。
- 生成结果保存到线索详情页。
- 生成话术前，页面能展示推荐应用方向、缺失信息和下一步问诊问题。

### Step 6：跟进记录和演示 Dashboard

目标：

- 将评分、话术、跟进动作串成线索时间线。
- Dashboard 展示关键指标。

建议文件：

```text
src/app/page.tsx
src/components/leads/LeadTimeline.tsx
src/components/followups/FollowUpForm.tsx
src/app/api/follow-ups/route.ts
```

验收：

- 线索详情能看到评分历史、生成话术、跟进记录。
- Dashboard 展示线索总数、A级线索数、待跟进数、已生成话术数。

## P1：增强智能和批量能力

目标：提升销售团队真实使用效率。

功能：

- CSV 批量导入线索。
- 批量评分。
- 线索分群。
- 更完善的知识库检索。
- Prompt 模板管理。
- 评分规则可配置。
- 销售话术反馈：好用/需修改/不准确。
- 支持清力/超滑项目的四条拓客主线：发电机、人形机器人、6G 射频、精密材料。
- 新增字段：应用部件、摩擦痛点、验证方式、证据需求。
- 将当前关键词资产升级为 RAG-ready 架构：Source Registry、Chunk、Metadata、ReviewStatus。
- 支持半自动 URL 抽取：用户输入官网/展会/新闻链接，系统抽取公司、产品、应用场景和痛点。

参考架构研究：

```text
docs/b2b-marketing-agent-architecture.md
docs/literature-knowledge-base.md
```

重点：

- 引入任务队列，避免批量任务阻塞。
- 引入评分版本，便于复盘。
- 前端增加批量操作和筛选器。

## P2：外部数据和自动化

目标：从“辅助分析”走向“自动拓客工作台”。

功能：

- 企业数据源接入。
- 官网/展会/表单线索接入。
- 邮件或飞书/企微消息生成草稿。
- 自动跟进提醒。
- Campaign 自动化。
- 更细的权限和团队管理。

重点：

- 所有外部触达先做“生成草稿 + 人工确认”。
- 不直接自动群发，避免合规和品牌风险。

## P3：销售增长系统

目标：让系统从单点工具升级为销售增长闭环。

功能：

- 成交/丢单原因回流。
- 话术效果分析。
- 行业策略看板。
- 产品机会分析。
- 不同销售人员的话术风格和转化对比。
- Agent 自动推荐下一批目标客户。

## Review Gate 作为前置步骤

在正式做任何新一轮技术调研、竞品分析、开源选型前，先走以下步骤：

1. 收集候选项目的官方证据。
2. 记录 URL、抓取时间、证据类型。
3. 区分 repo 事实、公司事实和推断结论。
4. 遇到主体状态不清楚的项目，标记为“待核验”。
5. 只有通过 review gate 的项目才能进入最终对比表。

当前 5 个 GitHub 前辈项目的 review 台账见：

```text
docs/open-source-review-register.md
```

## 架构决策

### 采用前后端一体

原因：

- 当前目标强调可演示和快速验证。
- Agent 能力必须直接体现在页面中。
- Next.js 全栈能减少前后端割裂和接口等待。

### 后端不能只是 demo

即使 P0 快速开发，也必须保留清晰边界：

```text
UI -> API Route -> Service/Agent -> Repository -> Database
```

Agent 不直接读写数据库，统一通过服务层和仓储层。

### AI 能力必须可替换

LLM Provider 独立封装：

```text
src/server/llm/provider.ts
```

后续可切换 OpenAI-compatible、国产模型、本地模型。

### 评分必须可解释

不要只让模型输出一个分数。必须保留：

- 规则分
- AI 判断
- 证据
- 版本
- 时间

## P0 技术验收清单

- [ ] 本地启动成功
- [ ] 数据库迁移成功
- [ ] 线索 CRUD 完成
- [ ] 产品/知识库 CRUD 完成
- [ ] 评分 API 完成
- [ ] 话术生成 API 完成
- [ ] 线索详情页完整串联
- [ ] Dashboard 可演示
- [ ] 有 5-10 条内置 demo 数据
- [ ] README 写清启动方式

## 风险与控制

| 风险 | 控制方式 |
| --- | --- |
| AI 话术空泛 | 强制注入产品知识、客户画像和应用场景 |
| 评分不可解释 | 规则分 + AI 理由 + 证据 |
| 前后端割裂 | 每个 API 同步做页面入口 |
| P0 范围失控 | 不做外部数据抓取、不做自动群发、不做完整 CRM |
| 专业参数错误 | 技术知识库可维护，生成内容展示引用依据 |
| 销售不信任 AI | 保留人工编辑、反馈、评分解释 |

## 下一步执行建议

第一开发批次只做 3 件事：

1. 初始化 Next.js 全栈项目和数据库。
2. 实现 Lead/Product/Knowledge 基础模型和页面。
3. 做通单条线索的评分和话术生成。

完成后再进入批量导入和批量评分。
