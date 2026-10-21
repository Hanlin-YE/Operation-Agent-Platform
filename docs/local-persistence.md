# 本地数据、后台任务与模型配置

本轮把本地业务记录从整份 JSON 覆盖写入迁移到 SQLite；后台任务由独立 Node worker 执行。页面关闭后 worker 继续运行，整个程序关闭后记录保留，重启识别中断任务并提供显式重试。第一阶段以完整记录、失败重试为主。

## 启动与使用

在项目根目录使用 Node.js 22.13+（本轮验证：22.22.3）：

```sh
npm install
npm run dev
```

该命令同时启动 Next.js 和 worker。生产环境使用 `npm run build` 后运行 `npm start`；独立 worker 使用 `npm run worker`。worker 是常驻本地进程，适合本机/常驻服务器运行。Cloudflare、临时演示模式不执行持久后台任务。

1. 打开侧栏「本地设置」(`/settings`)，添加服务地址、模型名称和密钥，选择 Chat Completions 或 Responses 协议。
2. 为销售话术、内容生成、视频分析、销售培训分别选择模型，保存后点击「测试连接」。检测发送最小请求，错误区分 HTTP 鉴权、权限、地址/模型、额度、服务端错误、网络及超时。
3. 在原业务页面提交视频分析或销售话术；内容策略/返修 API 返回 `202` 与任务 ID；批量线索评分从「后台任务」(`/tasks`) 提交。
4. 任务中心显示执行进度、结果、错误、模型快照和各次尝试记录。失败/中断任务点击「重试任务」使用当前模型设置。

视频提取继续使用本地 Python、ffmpeg、Whisper 和 PySceneDetect。仅启动视频 API 时，在 `agent_root` 目录执行：

```sh
VIDEO_ANALYZER_ENABLED=true python3 -m uvicorn src.local_app:app --host 127.0.0.1 --port 8001
```

此入口不启动 PostgreSQL、Redis、Neo4j 或旧的外部任务调度。Python 默认读取项目根目录 `data/model-settings.json`；改变数据位置时，Web、worker 与 Python 使用相同的绝对路径 `LOCAL_DATA_DIR`。视频记录默认在 `agent_root/data/video-analysis-jobs.sqlite`；自定义视频存储目录时，同时将 Web 的 `LOCAL_AGENT_DATA_DIR` 指向该目录，以纳入备份。

## 数据文件与迁移

| 路径 | 内容 |
| --- | --- |
| `data/operations.sqlite` | 业务记录、迁移标记、任务、尝试、worker 心跳和远端任务引用 |
| `data/model-settings.json` | 模型参数及密钥；文件权限 0600，仓库忽略 |
| `data/attachments/` | 按内容哈希命名的视频、PDF、图片；数据库存路径 |
| `data/rag-demo-files/` | 已有 RAG PDF 附件，保持原路径 |
| `agent_root/data/video-analysis-jobs.sqlite` | Python 视频分析过程、证据及结果 |
| `agent_root/data/video-sources/` | 新视频任务的本地输入/下载文件 |
| `data/backups/<时间与编号>/` | 数据库快照、附件及 SHA-256 清单 |

首次访问或启动 worker 自动迁移 `app-data.json`、`content-operations.json`、`aigc-jobs.json`、`rag-demo-data.json`。Python 服务首次启动迁移旧视频任务 JSON。也可执行：

```sh
npm run db:migrate
```

迁移按数据域在事务内执行，原 JSON 保留，并在旁边生成 `.pre-sqlite.bak`。已迁移的数据域再次启动直接读取 SQLite。旧文件损坏或结构错误时会报出错误，保留原文件供修复。已有视频任务的历史结果保留；旧版本曾清理的上传源文件仍处于缺失状态，新提交的视频保存源文件。

每个集合中的记录独立存储。写入仅提交相对于读取快照的变更，SQLite WAL + FULL 同步 + 写事务保证多进程写入有序。不同请求新增不同记录可同时保存；同一记录的冲突修改明确失败，刷新后可重试。

## 备份与恢复

在设置页点击「创建完整备份」，或在根目录执行：

```sh
npm run db:backup
```

输出目录含一致性数据库快照、当前本地附件和哈希清单。模型密钥继续留在本机受保护文件中，普通备份不包含密钥；更换电脑后可在设置页重新填写。外部 URL 仍保存为 URL，不自动下载远端素材。

恢复时停止 Web、worker 与 Python 视频服务，在根目录执行：

```sh
npm run db:restore -- /完整/备份目录 --offline
```

恢复先验证文件哈希和 SQLite 完整性，再备份当前状态，最后恢复记录与附件。记录恢复在事务中完成，文件写入出错会回滚已替换文件；恢复前安全备份保留在 `data/backups`。旧 RAG 的绝对附件路径按原项目位置恢复；本轮新附件使用相对路径。备份中的排队/执行中任务会标为中断，等待用户重试。

## 任务语义与排查

- `queued → running → succeeded / failed`；心跳租约超过 30 秒失效后，`running → interrupted`。队列任务在 worker 启动后继续执行；失败和中断任务由用户显式重试。
- 同一任务类型、输入和模型配置的重复提交返回原记录，SQL 唯一约束阻止两个进程重复创建。事务领取防止多个 worker 同时执行同一任务。
- 同一批量任务重试时，评分记录使用任务与线索的稳定 ID，已保存结果可复用。视频远端任务引用在 SQLite 持久化，等待中断后先查询原任务，再决定是否重建。
- 一般模型生成采用整任务重试。外部模型调用与本地 SQLite 之间尚无分布式事务：远端生成已完成、但本地尚未确认时崩溃，显式重试仍可能再次计费。系统不对这些任务进行自动循环重试。
- 模型快照保存模型 ID、服务地址、协议、温度、输出长度和超时，密钥在执行时从受保护文件读取。当前密钥被更新后，旧任务使用当前密钥和已记录的模型参数。
- 执行器离线：检查 `npm run worker` 终端；模型配置不完整：在设置页保存并检测；视频签名校验失败：确认 Web 与 Python 共用 `LOCAL_DATA_DIR`，并保存统一设置。

## 验证

```sh
npm run test:local
npx tsx --test test/*.test.ts test/*.test.tsx test/storage/*.test.ts
npm run typecheck
npm run build:verify
```

本轮新增测试覆盖：迁移幂等和损坏文件保护、重启读取、四进程并发插入、同一记录冲突、备份恢复与损坏备份拒绝、密钥脱敏/权限、模型错误、任务去重/租约、独立 worker 终止后重试。模型网络测试使用本地模拟服务；真实模型的付费生成与完整视频转写效果另行通过实际素材验收。

### 本轮检查结果（2026-10-20）

- TypeScript 全量：119 项通过；Python 视频与模型相关：18 项通过；类型检查和生产构建通过。
- 四份旧业务 JSON 与迁移后的读取结果逐项完全一致；12 条历史 Python 视频任务保留。
- 浏览器验证：批量评分完成、模型保存与脱敏、模拟连接检测、备份按钮；390px 页面无横向溢出。浏览器窗口最小化导致截图接口未产出截图。
- Python 全量另有一项原有失败：`test_account_model` 引用了仓库缺失的 `src.models.account`。本轮没有新增 PostgreSQL 模型或依赖。

SQLite 运行时依据本机 Node.js 22.22.3 验证；接口参考 [Node.js SQLite 文档](https://nodejs.org/download/release/latest-jod/docs/api/sqlite.html)。
