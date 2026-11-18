# Friction X 内部销售工作台

本分支围绕「线索 → 规则评分 → 话术 → 跟进」维护日常销售流程。

- 首页显示逾期、今天到期和未安排日期的跟进任务，按北京时间计算。
- 从左侧「线索管理」进入客户详情，点击「编辑线索」维护客户资料。资料修改后请重新评分。
- 话术可编辑、保存。保存为跟进任务时使用当前编辑内容，生成、修改保存及话术转跟进均执行参数承诺规则检查。
- 内容运营、论文库、市场研究、图谱与培训入口集中到「实验区」，暂停继续扩展。

本地启动：

```sh
npm ci
npm run dev -- --hostname 127.0.0.1
```

默认将数据写入 `data/app-data.json`。不要在日常使用时设置 `DEMO_EPHEMERAL_STORE=true` 或 `CLOUDFLARE=true`，这两个开关使用内存演示数据，重启会丢失修改。本次没有迁移数据库，单文件存储仍不适合多人并发写入。

验证：

```sh
npm run test:sales
npm run typecheck
npm run lint
npm run build:verify
```

参数检查会保守拦截保证措辞、量化性能及期限，包括从产品资料引用的数值。它不能识别所有表达或验证事实，销售仍需人工审核，客户工况下的性能与交期须以技术验证和书面确认为准。

详细操作及验收见 [销售流程说明](docs/sales-daily-workflow.md)。使用与维护手册提供 [PDF](docs/manual/sales-workbench-manual.pdf) 和 [TeX 源文件](docs/manual/sales-workbench-manual.tex)，包含启动、日常操作、模型配置、备份恢复和升级维护。

---

以下为上游版本历史说明，涉及演示、内容运营和外部接入的部分不属于本分支日常销售范围。

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

开发服务器使用独立的 `.next-dev` 缓存目录，因此不会被生产构建覆盖。开发过程中如需验证生产构建，请运行：

```bash
npm run build:verify
```

该命令使用 `.next-verify`，不会影响正在运行的开发预览。`npm run build` 保留给生产构建、CI 和部署流程。

## 本地视频拆解服务

`/aigc?type=video` 使用本地视频证据链：`faster-whisper` 转写、`PySceneDetect` 切分镜头，再由与网页相同的模型配置整理成待人工审核的中文剧本。它不依赖第三方网页服务，也不会在未配置模型时伪造结果。

首次启用（会下载 Python 依赖和所选 Whisper 模型）前，复制并填写 `agent_root/.env`：

```bash
cd agent_root
python3 -m pip install -r requirements.txt
VIDEO_ANALYZER_ENABLED=true OPENAI_API_KEY=... OPENAI_MODEL=... python3 -m uvicorn src.main:app --port 8001
```

网页项目的 `.env` 中保持 `VIDEO_ANALYZER_BASE_URL=http://127.0.0.1:8001/api/video-analysis`，然后启动 `npm run dev` 并打开 `/aigc?type=video`。本机还需要可用的 `ffmpeg` / `ffprobe`。视频最大 300MB；提取结果先进入人工核验，不会自动进入内容生产。

## 验证

```bash
npm run typecheck
npm run build:verify
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

销售培训中心的产品学习、市场培训和营销话术问答默认接入 DeepSeek。没有配置 `DEEPSEEK_API_KEY` 时，系统会返回明确的服务未连接提示。

```bash
DEEPSEEK_API_KEY=...
DEEPSEEK_MODEL=deepseek-chat
```

其它 Agent 能力没有配置 `OPENAI_API_KEY` 时，会使用可演示的本地模板生成专业话术。

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
