# AIGC Sales Agent 开源项目调研

更新时间：2026-07-12

## 调研目标

为“电机销售拓客、自动生成专业销售话术、智能筛选潜在客户”的 AIGC 销售 Agent 选型参考 5 个高 Star 开源项目，重点分析：

- 架构分层和前后端协同方式
- Agent / Workflow / CRM / Lead Scoring 的代码实现思路
- 对我们产品目标可直接借鉴的部分
- 不适合照搬的部分

## 研究纪律

本次调研新增一条硬规则：

- 如果某个项目的 repo 状态、公司主体状态、活跃度或许可证无法同时核验，不能直接写入最终推荐名单。
- 如果只能确认 repo，不能推断公司主体是否存续。
- 如果只能确认搜索结果，不能直接当作官方事实。

相关 review 机制见：[review 架构](/Users/hanlinye/Desktop/vibe%20作品集/运营自动化企业级agent/docs/review-architecture.md)。

> 说明：GitHub Star 会变化，本文 star 数以 2026-07-12 查询 GitHub 页面/API 时的量级为准。若后续进入正式技术设计，应再用 `gh api repos/<owner>/<repo>` 复核一次。

> 纠偏说明：如果任何项目的主体状态存在争议，必须先进入 `待核验`，不能直接写成“可借鉴标杆”。

## 选中的 5 个项目

> 重要修正：下面 5 个项目当前只作为“GitHub 开源项目架构参考”，不是“公司主体或商业成熟度已经核验通过”的标杆公司。逐项 review 台账见：[GitHub 前辈开源项目 Review 台账](/Users/hanlinye/Desktop/vibe%20作品集/运营自动化企业级agent/docs/open-source-review-register.md)。

| 项目 | 方向 | Star 量级 | 为什么选它 |
| --- | --- | ---: | --- |
| Dify | LLM 应用、Agent、RAG、工作流平台 | 约 100k+ | 最接近“企业级 AI 应用平台”，有前端工作台、后端 API、队列、知识库、工具调用等完整生产结构 |
| Langflow | 可视化 Agent / 工作流编排 | 约 100k+ | 对“可演示、可配置、前后端联动”的工作流体验非常有参考价值 |
| Flowise | 低代码 LLM / Agent 编排 | 约 50k+ | Node/TypeScript 体系，组件化节点、Chatflow、Tool 抽象适合快速做销售 Agent 原型 |
| Twenty | 现代 CRM | 约 30k+ | 直接对应“潜在客户、公司、联系人、商机、活动记录”的数据模型和 CRM 工作台 |
| Mautic | 营销自动化、Lead Scoring、Campaign | 约 10k+ | 对“智能筛选潜在客户、线索评分、营销触达自动化”最有业务参考价值 |

备选但本轮不深入：Chatwoot。它适合客服/会话承接，但我们的当前目标更偏“销售拓客 + 话术 + 潜客筛选”，Mautic 的 lead scoring 和 campaign 价值更直接。

## 1. Dify

仓库：[langgenius/dify](https://github.com/langgenius/dify)

### 产品定位

Dify 是一个面向生产环境的 LLM 应用开发平台，核心能力通常包括应用构建、Agent、工作流、知识库、模型供应商接入、工具调用、数据集/RAG、日志和部署。

### 架构特征

典型分层：

- `web`：前端控制台，承载应用创建、工作流配置、知识库管理、日志查看等 UI。
- `api`：后端 API，负责业务实体、应用运行、Agent/Workflow 执行、鉴权、租户、数据集等。
- `worker` / 队列：处理异步任务，如文档索引、长流程执行、后台任务。
- `docker` / 部署配置：本地和私有化部署友好。
- 模型供应商适配层：隔离 OpenAI、Anthropic、国产模型等差异。
- 数据层：应用、会话、消息、工具调用、知识库、向量索引、租户权限等。

### 代码实现可借鉴点

1. **应用即配置**
   Dify 不是把 Agent 写死在代码里，而是把应用、Prompt、模型、工具、知识库、工作流作为配置化实体。这对我们很重要：不同电机品类、不同销售场景、不同客户行业的话术策略应该能配置，而不是改代码。

2. **运行态和编辑态分离**
   前端负责编辑 Agent/Workflow/知识库，后端负责稳定执行。我们也应区分：
   - 编辑态：销售主管配置 ICP、行业、产品参数、话术模板、评分规则。
   - 运行态：销售员输入公司/联系人/线索池，Agent 生成话术、评分、下一步动作。

3. **知识库是核心能力，不是附属功能**
   电机销售非常依赖专业资料：功率、转速、扭矩、应用工况、防护等级、能效等级、认证、替代型号、常见异议。应学习 Dify 的知识库/RAG 思路，把产品手册、行业案例、FAQ、竞品对比做成可检索资产。

4. **异步任务和日志**
   销售拓客可能涉及批量导入公司名单、联网补全、批量生成话术、批量评分。必须通过任务队列执行，并展示进度、失败原因和重试结果。

### 不适合照搬点

- Dify 是通用 AI 平台，功能很重。我们不需要先做完整 AI 平台，应该聚焦“电机销售 Agent”。
- Dify 的工作流能力强，但如果照搬会导致 MVP 过早复杂化。第一阶段应保留“固定销售流程 + 少量可配置策略”。

### 对我们的启发

我们应采用“轻量 Dify 化”：

- 前端有一个销售 Agent 工作台。
- 后端有统一 Agent Runtime。
- 产品资料和销售 SOP 进入知识库。
- 线索评分、话术生成、跟进建议都可追踪。
- 所有生成内容都保留引用依据和版本记录。

## 2. Langflow

仓库：[langflow-ai/langflow](https://github.com/langflow-ai/langflow)

### 产品定位

Langflow 是一个可视化构建 Agent 和 AI 工作流的项目，强调拖拽式节点编排、组件化、可运行可调试。

### 架构特征

典型分层：

- 前端画布：节点、连线、参数面板、运行结果展示。
- 后端执行引擎：把前端图结构转换成可执行 DAG。
- 组件注册机制：每类节点暴露输入、输出、参数和运行逻辑。
- API 层：保存 flow、运行 flow、获取结果。
- 模板和 marketplace 思路：复用已有 flow。

### 代码实现可借鉴点

1. **节点组件标准化**
   对我们来说，可以把销售流程拆成节点：
   - 线索导入
   - 公司画像补全
   - ICP 匹配
   - 产品适配判断
   - 采购意图判断
   - 话术生成
   - 邮件/微信/电话脚本生成
   - CRM 跟进任务创建

2. **可视化演示价值高**
   用户会更容易理解“AI 怎么做判断”。比如一个潜客评分流程，可以在前端展示：
   `公司行业 -> 应用场景 -> 年采购可能性 -> 产品匹配 -> 决策人线索 -> 最终评分`。

3. **参数面板思路**
   每个节点都有参数。我们可以让销售主管调整：
   - 目标行业权重
   - 公司规模权重
   - 是否优先 OEM/设备厂
   - 是否排除贸易商
   - 低价敏感客户扣分
   - 高技术适配客户加分

### 不适合照搬点

- 完整画布编辑器开发成本高，不适合 P0。
- 对销售用户来说，太自由的流程编排反而会增加学习成本。

### 对我们的启发

P0 不做完整画布，做“固定流程的可解释步骤条”：

```text
线索输入 -> 公司画像 -> 产品匹配 -> 潜客评分 -> 话术生成 -> 跟进建议
```

P1 再把每一步参数化，P2 才考虑可视化编排。

## 3. Flowise

仓库：[FlowiseAI/Flowise](https://github.com/FlowiseAI/Flowise)

### 产品定位

Flowise 是低代码 LLM 应用和 Agent Flow 构建工具，技术栈偏 Node.js / TypeScript，常见结构是多 package 组织，例如 server、ui、components 等。

### 架构特征

典型分层：

- UI：Chatflow / Agentflow 的搭建界面。
- Server：提供流程保存、执行、聊天接口、凭证管理。
- Components：每个节点/工具/模型/向量库作为独立组件注册。
- Credentials：模型 Key、第三方 API Key 的受控管理。
- Chat/Prediction API：对外暴露运行接口。

### 代码实现可借鉴点

1. **Node 组件包机制**
   Flowise 的节点抽象适合我们做“销售能力组件”：
   - `LeadEnrichmentTool`
   - `MotorProductMatcher`
   - `LeadScoringNode`
   - `SalesPitchGenerator`
   - `ObjectionHandlerGenerator`
   - `FollowUpPlanner`

2. **凭证管理**
   拓客 Agent 可能接入企查查、海关数据、CRM、邮箱、钉钉、企微、搜索 API。必须学习 Flowise 的 credential 隔离思路：前端不直接暴露密钥，后端按租户读取。

3. **可嵌入 API**
   Flowise 能作为流程执行 API 被外部调用。我们也应该从一开始设计：
   - 前端工作台调用同一套后端 API。
   - 后续钉钉/企微机器人也调用同一套 Agent API。
   - 不要把智能逻辑写死在前端页面里。

### 不适合照搬点

- Flowise 偏通用 AI Flow，不理解 CRM 数据模型。
- 如果直接以 Flowise 作为主系统，会导致销售业务对象被弱化。

### 对我们的启发

我们可以借鉴“组件注册 + 执行 API”，但业务主线仍以 CRM/Lead 为中心，而不是以 Flow 为中心。

## 4. Twenty

仓库：[twentyhq/twenty](https://github.com/twentyhq/twenty)

### 产品定位

Twenty 是现代开源 CRM，重点对象包括公司、联系人、机会、活动、任务、字段、视图、权限和工作流。

### 架构特征

典型分层：

- 前端 CRM 工作台：列表、详情页、Kanban、筛选、字段配置、活动时间线。
- 后端服务：用户、工作区、对象模型、权限、搜索、数据同步。
- 数据模型：Company、Person、Opportunity、Task、Activity 等。
- 自定义字段和视图：支持不同企业配置自己的 CRM 字段。
- 集成和同步：邮件、日历、第三方服务等。

### 代码实现可借鉴点

1. **销售对象模型**
   我们必须先定义清楚自己的核心对象：
   - `Lead`：潜在线索
   - `Company`：企业客户
   - `Contact`：联系人
   - `Opportunity`：商机
   - `Product`：电机产品/型号
   - `UseCase`：应用场景，如泵、风机、输送线、机器人、压缩机
   - `Interaction`：电话、邮件、微信、展会、拜访记录
   - `GeneratedPitch`：AI 生成话术
   - `LeadScore`：评分记录

2. **列表视图和筛选是销售刚需**
   “智能筛选潜在客户”最终一定要落在列表、筛选、排序、标签、批量操作上，而不只是聊天问答。

3. **活动时间线**
   每次 AI 生成话术、推荐理由、销售跟进、客户反馈都应写入时间线，形成可复盘的销售资产。

4. **自定义字段**
   电机行业字段很多，例如电压、功率、转速、安装方式、绝缘等级、防护等级、认证、应用场景、采购周期。需要类似 Twenty 的字段扩展能力，但 P0 可以先做固定字段。

### 不适合照搬点

- Twenty 是完整 CRM，范围比我们大。我们当前不需要替代 CRM，而是做“销售智能层 + 轻 CRM 工作台”。
- 不要先陷入复杂权限、自定义对象、数据同步。

### 对我们的启发

我们的产品骨架应该是 CRM-first，而不是 Chat-first：

```text
线索列表 / 公司详情 / 产品匹配 / AI 话术 / 跟进任务
```

聊天只是辅助入口，主界面应是销售工作台。

## 5. Mautic

仓库：[mautic/mautic](https://github.com/mautic/mautic)

### 产品定位

Mautic 是开源营销自动化平台，核心能力包括联系人管理、细分、Campaign、表单、邮件、页面、Lead Scoring、自动化触达等。

### 架构特征

典型分层：

- PHP / Symfony 应用架构。
- Bundle / Plugin 机制组织业务模块。
- Contact / Segment / Campaign / Email / Form / Point 等领域模型。
- Campaign Builder：通过条件、动作、决策构成营销自动化流程。
- Lead Scoring：基于行为和属性累计分数。
- Cron / Queue：定时执行 Campaign、邮件、数据更新等。

### 代码实现可借鉴点

1. **Lead Scoring 是核心资产**
   对我们来说，潜客筛选不应只是 LLM 给一个主观分，而应是“规则分 + AI 判断分 + 证据”的组合：
   - 行业匹配分
   - 公司规模分
   - 应用场景分
   - 电机采购可能性分
   - 近期触发事件分
   - 决策人可触达分
   - 价格敏感/低质线索扣分

2. **Segment 分群**
   销售不是只要一个总分，而要不同分群：
   - 高优先级设备厂
   - 可能替换竞品客户
   - 低预算但高频询价客户
   - 需要长期培育客户
   - 暂不跟进客户

3. **Campaign 自动化**
   Mautic 的 Campaign 思路适合我们做 P1/P2：
   - 新线索导入后自动画像
   - 评分超过阈值生成销售任务
   - 未回复 3 天生成二次跟进话术
   - 客户提出价格异议后生成降本价值话术

4. **行为事件驱动**
   未来如果接邮件、官网表单、展会扫码、询盘表单，客户行为可以自动改变分数。

### 不适合照搬点

- Mautic 偏营销自动化，不是 AIGC 专业销售 Agent。
- 技术栈 PHP/Symfony 不一定适合我们从零快速开发。

### 对我们的启发

P0 应先实现“可解释 Lead Score”，P1 加入分群和自动跟进，P2 才做复杂 Campaign Builder。

## 横向对比

| 维度 | Dify | Langflow | Flowise | Twenty | Mautic |
| --- | --- | --- | --- | --- | --- |
| 最强点 | 企业级 AI 应用平台 | 可视化流程 | 低代码 Agent 组件 | CRM 数据模型 | 线索评分/营销自动化 |
| 最适合借鉴 | Agent Runtime、知识库、日志 | 流程可解释、节点参数 | 工具/组件注册、凭证 | 销售工作台、对象模型 | Lead Scoring、Segment |
| 前端价值 | AI 应用配置台 | 工作流画布 | Chatflow 配置 | CRM 列表/详情 | Campaign/Segment 配置 |
| 后端价值 | API、队列、知识库、执行引擎 | DAG 执行 | Node 组件执行 | 数据模型和权限 | 规则引擎和定时任务 |
| 对我们的风险 | 太重 | P0 复杂 | 业务模型弱 | CRM 范围过大 | 非 AI、技术栈不一定合适 |

## 我们应采用的综合架构

结论：采用“CRM-first + Agent Runtime + RAG Knowledge + Lead Scoring Engine”的架构。

不建议做成纯聊天机器人，也不建议一开始做通用 Flow 平台。正确路径是：

1. Twenty 式 CRM 工作台作为用户主界面。
2. Dify 式知识库和 Agent Runtime 作为智能中枢。
3. Mautic 式 Lead Scoring 作为潜客筛选核心。
4. Flowise/Langflow 式组件化流程作为后续可配置能力。

## 面向电机销售的核心对象

```text
Company
  - 行业
  - 规模
  - 地区
  - 产品/设备类型
  - 采购可能性

Contact
  - 姓名
  - 职位
  - 部门
  - 联系方式
  - 决策影响力

Lead
  - 来源
  - 状态
  - 标签
  - 当前评分
  - 推荐动作

MotorProduct
  - 型号
  - 功率
  - 电压
  - 转速
  - 扭矩
  - 防护等级
  - 应用场景
  - 认证

LeadScore
  - 总分
  - 分项分
  - 评分证据
  - AI 判断理由
  - 版本

GeneratedPitch
  - 场景
  - 渠道
  - 客户画像
  - 产品匹配依据
  - 话术正文
  - 风险提示
```

## 建议技术路线

P0 推荐：

- 前端：Next.js 或 React + TypeScript
- 后端：Next.js API Routes / NestJS / FastAPI 三选一。若强调前后端一体和快速演示，优先 Next.js 全栈。
- 数据库：PostgreSQL
- ORM：Prisma
- 向量库：先用 PostgreSQL + pgvector，后续再拆到 Qdrant/Milvus。
- 队列：P0 可用数据库任务表，P1 引入 BullMQ/Redis。
- LLM Provider：抽象 provider 层，先支持 OpenAI-compatible API。
- 文档解析：P0 支持 Markdown/PDF/TXT 上传到知识库。

## 来源

- Dify GitHub 仓库：https://github.com/langgenius/dify
- Langflow GitHub 仓库：https://github.com/langflow-ai/langflow
- Flowise GitHub 仓库：https://github.com/FlowiseAI/Flowise
- Twenty GitHub 仓库：https://github.com/twentyhq/twenty
- Mautic GitHub 仓库：https://github.com/mautic/mautic
