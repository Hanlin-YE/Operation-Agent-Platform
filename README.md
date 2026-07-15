# 电机销售拓客 AIGC Sales Agent

一个面向电机销售团队的 P0 全栈演示版本，用来辅助：

- 智能筛选潜在客户
- 生成可解释的线索评分
- 基于电机产品知识库生成专业销售话术
- 保存跟进记录，形成销售时间线

## 当前实现

```text
Dashboard
Leads 列表/详情
Products 电机产品库
Knowledge 销售知识库
Lead Scoring Agent
Pitch Generation Agent
Follow-up 时间线
PRD 查看页
```

## 技术栈

- Next.js App Router
- TypeScript
- React
- lucide-react
- 文件持久化本地数据层：`data/app-data.json`

P0 为了保证快速演示，先使用文件数据层。后续切 PostgreSQL/Prisma 时，只需要替换 `src/server/repositories/*`。

## 启动

```bash
npm install
npm run build
npm start
```

打开：

```text
http://localhost:3000
```

开发模式：

```bash
npm run dev
```

## 验证

```bash
npm run typecheck
npm run build
```

## 演示流程

1. 打开 `http://localhost:3000/leads`
2. 进入一条线索详情
3. 点击 `AI 评分`
4. 选择话术场景并点击 `生成话术`
5. 点击 `保存跟进`
6. 在线索时间线查看评分、话术和跟进记录

## 关键目录

```text
docs/
  open-source-research.md
  prd.md
  implementation-priorities.md

src/app/
  api/
  leads/
  products/
  knowledge/
  agent/

src/server/
  agents/
  data/
  llm/
  rag/
  repositories/
  scoring/
```

## LLM 配置

默认没有配置 `OPENAI_API_KEY` 时，系统会使用可演示的本地模板生成专业话术。

如需接入 OpenAI-compatible API：

```bash
OPENAI_API_KEY=...
OPENAI_BASE_URL=https://api.openai.com/v1/chat/completions
OPENAI_MODEL=gpt-4o-mini
```

## 产品方向

当前版本遵循：

```text
CRM-first 销售工作台
+ Agent Runtime
+ 产品/销售知识库
+ 可解释 Lead Scoring
+ 专业话术生成
+ 前后端一体演示
```
