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

## Cloudflare 上线

这个项目可以作为 Cloudflare Workers 上的在线演示版运行：

- 页面和本地 API 可直接部署到 Cloudflare
- 部署到 Cloudflare 时，数据层会自动切换为“内存演示模式”
- 这意味着线索、话术、跟进记录在运行时可写，但不会像本地 `data/app-data.json` 那样持久保存

首次配置：

```bash
npm install
npx wrangler login
```

本地预览 Cloudflare 产物：

```bash
npm run preview:cloudflare
```

正式部署：

```bash
npm run deploy:cloudflare
```

## GitHub 上线流程

仓库已经补齐了 GitHub Actions 工作流：

- `/.github/workflows/ci.yml`
- `/.github/workflows/deploy-cloudflare.yml`

在推送到 GitHub 前，先把本地仓库绑定到你的远程仓库：

```bash
git remote add origin <你的-github-repo-url>
git add .
git commit -m "Add Cloudflare deployment pipeline"
git push -u origin main
```

首次在 GitHub 启用自动部署时，需要在仓库 `Settings -> Secrets and variables -> Actions` 中添加：

```bash
CLOUDFLARE_ACCOUNT_ID=...
CLOUDFLARE_API_TOKEN=...
```

推荐的触发方式：

- 每次推送到 `main` 时先跑 CI
- 同一次推送会触发 Cloudflare 自动部署
- 也可以在 GitHub Actions 页面手动执行 `Deploy Cloudflare Worker`

如需接入远端 Python Agent API，可在 Cloudflare Worker 环境变量中设置：

```bash
AGENT_API_BASE_URL=https://your-agent-api.example.com
OPENAI_API_KEY=...
OPENAI_BASE_URL=https://api.openai.com/v1/chat/completions
OPENAI_MODEL=gpt-4o-mini
```

如果要把这些变量也放到 Cloudflare 线上环境：

```bash
npx wrangler secret put OPENAI_API_KEY
npx wrangler secret put AGENT_API_BASE_URL
npx wrangler secret put OPENAI_BASE_URL
npx wrangler secret put OPENAI_MODEL
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
