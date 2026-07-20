# AIGC 获客、留存与智能客服实施规范（Spec Coding）v1.0

> 状态：执行基线  
> 更新：2026-07-14  
> 依据：[PRD](prd.md)、AIGC 运营获客与留存 Agent Spec v4.0、Friction X 产品资料、`DailyPersuasion_example.json`

## 1. 目标与边界

交付一个供**用户增长负责人**操作的控制台：其可管理账户分层、运营策略、内容/视频资产、审核与漏斗；对客侧由受控的智能客服完成需求采集、事实问答、视频推荐和人工交接。

产品事实只允许来自已审核的 Friction X 产品目录：自超滑有刷/无刷空心杯电机平台，以及“电机 + 齿轮箱 + FOC 控制器”整体方案。未披露参数必须返回“按项目选型确认”。

不做：无审核的自动报价、KA 自动营销、将网页原文传入模型、自由生成视频 URL、让 LLM 直接修改账户生命周期。

## 2. 架构收敛决策

| 决策 | 采用方案 | 原因 |
| --- | --- | --- |
| 前端 | 保留 Next.js 过渡控制台 | 当前已可运行；Vue 迁移是后续替换，不双栈并行开发 |
| 编排后端 | 保留 `agent_root` 的 FastAPI | 已有 API、状态机与处理器边界；不另起平行 `/backend` |
| 结构化主存储 | PostgreSQL + SQLAlchemy + Alembic | 支持账户、会话、事件、审计、事务与分析查询 |
| RAG | PostgreSQL `pgvector` | 避免同时维护 PostgreSQL 与 Chroma 两套向量存储 |
| 图关系 | Neo4j | 存放已审核实体、证据、生命周期和账户关系 |
| 运营控制面 | 钉钉业务表 + 钉钉文档 | 账户/任务/审核/视频/事件的可见控制面与反馈总线 |
| 异步 | 初期 asyncio runner；扩容后 Celery + Redis | 当前不引入未使用的队列依赖，达到多 worker 需求后再切换 |
| 模型 | `LlmProvider` 协议 + Provider 适配器 | 业务代码不绑定某一个模型或供应商 |

## 3. 数据契约

### 3.1 账户分层

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `account_tier` | `KA` / `LA` / `SMB` | 必填，人工可校正 |
| `tier_reason` | text | 规则与人工判定依据 |
| `coverage_scope` | `national` / `local` / `unknown` | 全国/本地覆盖判据 |
| `routing_policy` | `HUMAN_REQUIRED` / `HUMAN_APPROVAL` / `NURTURE_AUTOMATION` | 客服权限开关 |
| `owner_id` | user id | 客户经理或运营负责人 |
| `human_handoff_at` | timestamp | 强制/实际人工接管时间 |

规则：KA 只要进入客服即创建人工待办；LA 首次外发、报价和性能承诺待人工审核；SMB 仅在授权、频控和低风险策略下进入自动化培育。

### 3.2 智能客服

会话状态：`NEW → CONSENTED → DISCOVERING → QUALIFIED → NURTURING → HANDOFF_PENDING → HUMAN_OWNED / CLOSED`。

每条消息必须记录：`conversation_id`、`account_id`、`lead_id`、`speaker`、`intent`、`strategy_id`、`evidence_ids`、`video_key`、`handoff_reason`、`created_at`。模型输出必须为 JSON，包含 `reply`、`next_question`、`recommended_action` 与 `risk_flags`。

### 3.3 视频与行为事件

`VideoAsset`：`video_key`、`product_id`、`scenario`、`eligible_tiers`、`claim_version`、`review_status`、`asset_url`、`thumbnail_url`。

`InteractionEvent`：`event_type`（impression/play/complete/click/cta/appointment/message/handoff）、`asset_id`、`conversation_id`、`account_id`、`occurred_at`、`metadata_json`。视频 URL 只能由后端根据已审核 `video_key` 映射。

### 3.4 说服策略数据集

`DailyPersuasion_example.json` 作为**策略与评测数据集**，不是产品知识源。

| 原字段 | 系统用途 | 禁止用途 |
| --- | --- | --- |
| `scenario` | 场景/异议/会话阶段样本 | 映射为产品事实 |
| `strategy` | 形成策略标签库，如共情、澄清顾虑、小步 CTA、指导、转人工 | 直接照抄非电机话术 |
| `dialog.response` | 多轮对话离线评测样本 | 对客事实证据 |
| `dialog.analysis` | 离线提炼为有限 `strategy_id` | 暴露给客户或记录模型隐式推理 |

定制话术输入固定为：`客户上下文 + 账户分层 + 已审核产品/证据 + 策略标签 + 渠道/会话阶段`。缺少证据时必须追问或转人工。

## 4. 分阶段实施

### Phase 0：配置、依赖与基础设施

**目标**：在不破坏现有 Next.js 演示的情况下，使 FastAPI 可连接 PostgreSQL、Neo4j、钉钉和 Provider。

- 新增 PostgreSQL、`pgvector`、Alembic、SQLAlchemy 依赖及 Docker 服务。
- 使用 Pydantic Settings 读取 `.env`；真实凭据不提交版本库。
- 建立健康检查：`/healthz`、`/readyz` 分别检查进程与依赖。
- 钉钉业务表 创建账户、任务、审核、视频、事件表；记录 ID 映射。

**验收**：本地容器可启动；数据库迁移完成；钉钉测试表读写成功。
**阻塞条件**：钉钉 App 凭据、Base App Token、表 ID、Neo4j/PostgreSQL 可用地址。

### Phase 1：领域模型与持久层

**目标**：以 PostgreSQL 替换 JSON 演示数据作为权威结构化存储。

- SQLAlchemy 模型：`Account`、`Lead`、`LeadScore`、`Product`、`KnowledgeDocument`、`GeneratedPitch`、`FollowUp`、`VideoAsset`、`InteractionEvent`、`Conversation`、`ConversationMessage`、`AuditLog`。
- Product 表只允许从审核产品目录迁移；不开放自由创建。
- Neo4j 建立 `Company`、`Person`、`Product`、`Application`、`Knowledge`、`Evidence` 节点及约束。
- Repository 统一提供事务性 CRUD；Neo4j 写入只接收已审核事实。

**验收**：迁移创建表；账户/线索/事件可读写；产品目录无法被未审核 API 改写；已审核账户同步出图关系。

### Phase 2：钉钉控制面与账户分层

**目标**：钉钉成为贯穿式控制面与反馈总线，而非最终报表。

- `DingTalkControlPlaneClient` 实现 token、分页、幂等写入、重试、字段映射和 webhook 验签。
- 创建/同步账户、任务、审核、视频资产、行为事件；从 Base 人工校正回写 PostgreSQL。
- 分层引擎在导入/更新时计算 `KA/LA/SMB`，产生 `routing_policy` 和审计原因。
- KA 自动建立客户经理待办；LA 建立审核任务；SMB 进入授权与频控检查。

**验收**：创建 KA 账户后 5 分钟内有钉钉待办；人工改层后 PostgreSQL、Neo4j、Base 一致。

### Phase 3：导入、画像、评分与产品推荐

**目标**：完成增长负责人可操作的“导入 → 分层 → 画像 → 评分 → 推荐”路径。

- CSV 导入使用 Pandas，提供字段映射、预览、错误行报告和幂等去重。
- 画像补全只使用已有字段、审核证据与模型结构化输出；不可调用网页原文。
- 评分由确定性规则 + LLM 受限补充组成，返回维度解释与推荐动作。
- 推荐只在 Friction X 目录中选择产品，输出缺失参数、问诊问题和样品测试建议。

**验收**：导入 CSV 后能看到层级、评分、推荐产品及可解释理由；KA 不进入自动营销队列。

### Phase 4：话术、RAG 与 Review Agent

**目标**：用审核事实和策略库生成可追溯的定制话术。

- 文档导入、切片、嵌入与 `pgvector` 检索；保存来源、页码、版本和审核状态。
- 生成六类话术和客服候选回复；注入层级、会话阶段、策略标签及产品证据。
- Review Agent 检测未验证数字、型号泛化、价格承诺、越权触达和风险主张。
- LA 首次外发进入审核；KA 不生成自动外发内容。

**验收**：每条生成内容含引用和风险状态；无证据时无法产生性能承诺。

### Phase 5：智能客服、AIGC 视频与反馈闭环

**目标**：让对客会话、视频互动和增长反馈成为一个可控闭环。

- 实现 REST + SSE 流式会话 API；前端先提供嵌入式客服模拟器，后续接 H5 与钉钉 IM。
- 策略引擎先执行分层/权限/频控/转人工，再调用检索和 LLM。
- 视频匹配器由 `video_key` 返回审核资产；播放器上报事件。
- 行为事件写入 PostgreSQL 和钉钉，异步更新 Neo4j 兴趣、场景和生命周期关系。

**验收**：SMB 可完成 FAQ/视频/CTA；LA 关键内容待审核；KA 立即转人工；播放、完播和预约可追溯。

### Phase 6：图谱快照、前端闭环与发布

**目标**：增长负责人可查看、审计和复盘所有运营动作。

- `POST /api/graph/snapshot` 按账户、深度和时间范围查询 Neo4j，生成 Mermaid/SVG/PNG，回写钉钉文档或附件。
- 完成 Dashboard、导入、账户/线索详情、客服收件箱、审核队列、视频资产、Follow-ups、设置页。
- E2E：导入 → 分层 → 评分 → 推荐 → 话术/客服 → 视频 → 事件 → 图谱/钉钉反馈。
- 以 Docker Compose 部署 PostgreSQL、Neo4j、API；前端部署独立运行时。

**验收**：完整闭环可在前端演示；所有状态可从钉钉和 PostgreSQL 审计；依赖异常不会造成自动越权触达。

## 5. 当前完成度（2026-07-14）

| 能力 | 状态 | 说明 |
| --- | --- | --- |
| Next.js 基础工作台 | 部分完成 | Leads、产品目录、话术与任务控制台可演示 |
| 产品事实目录 | 部分完成 | 已锁定前端目录，尚未迁移到 PostgreSQL/审核流 |
| FastAPI Runs API | 骨架完成 | 当前使用内存控制面和演示素材 |
| LLM Provider 抽象 | 骨架完成 | 未接入业务任务与客服策略 |
| PostgreSQL / pgvector | 未开始 | 当前仍使用 JSON 数据文件 |
| 钉钉业务表 / 文档 | 未开始 | 仅有环境变量与内存适配器 |
| Neo4j 图谱 | 未开始 | 驱动存在，未接入 Schema/写入/查询 |
| KA/LA/SMB | 未开始 | PRD 已定义，尚未落入模型/API/UI |
| 智能客服 | 未开始 | PRD 已定义，尚无会话服务 |
| AIGC 视频闭环 | 未开始 | 只有 `video_key` DTO，无资产/播放器/事件 |
| 图谱快照 | 未开始 | 无 API、渲染或钉钉回写 |

## 6. 验收状态

所有 PRD 验收项在真实实现、自动化测试和前端 E2E 验证前均为未完成（`[ ]`）。禁止以页面静态展示、模拟数据或接口骨架标记为完成（`[x]`）。
