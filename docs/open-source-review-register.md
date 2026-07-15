# GitHub 前辈开源项目 Review 台账

更新时间：2026-07-12

## 为什么新增这份台账

之前补充的 `review-architecture.md` 只定义了 review 流程，没有把已经讨论过的 GitHub 前辈项目放进可执行台账，这是不完整的。

这份文档用于把“项目事实”“公司主体事实”“可借鉴结论”分开，避免再次出现 repo 能访问但公司主体状态未核验、却被直接写成成熟标杆的问题。

## 当前候选项目状态

| 项目 | GitHub 仓库 | Repo 层事实 | 公司主体状态 | 当前结论等级 | 能否进入 PRD/架构 |
| --- | --- | --- | --- | --- | --- |
| Dify | https://github.com/langgenius/dify | 已核验 repo 可访问；README 表述为开源 LLM 应用开发平台 | 未核验 | 可借鉴技术架构，不能引用公司状态 | 仅限技术架构借鉴 |
| Langflow | https://github.com/langflow-ai/langflow | 已核验 repo 可访问；README 表述为 AI agents/workflows 构建与部署工具 | 未核验 | 可借鉴流程编排，不引用公司状态 | 仅限技术架构借鉴 |
| Flowise | https://github.com/FlowiseAI/Flowise | 已核验 repo 可访问；README 表述为可视化构建 AI Agents | 未核验 | 可借鉴组件化 Agent Flow，不引用公司状态 | 仅限技术架构借鉴 |
| Twenty | https://github.com/twentyhq/twenty | 已核验 repo 可访问；README 表述为 Salesforce 的开源替代，面向 AI | 未核验 | 可借鉴 CRM 数据模型，不引用公司状态 | 仅限技术架构借鉴 |
| Mautic | https://github.com/mautic/mautic | 已核验 repo 可访问；README 表述为开源营销自动化软件 | 未核验 | 可借鉴 lead scoring / campaign，不引用公司状态 | 仅限技术架构借鉴 |

## 审查结论

截至 2026-07-12，以上 5 个项目只能作为“GitHub 开源项目架构参考”，不能作为“公司经营状态、商业成熟度、市场验证”的证据。

如果要把它们作为商业竞品或标杆公司，需要补充：

- 官方公司网站
- 公司主体存续状态
- 产品运营状态
- 最近 release / commit 活跃度
- 许可证与商用限制
- 官方案例或客户来源

## Review Gate 判定

| 维度 | Dify | Langflow | Flowise | Twenty | Mautic |
| --- | --- | --- | --- | --- | --- |
| Repo 可访问 | 通过 | 通过 | 通过 | 通过 | 通过 |
| README 定位明确 | 通过 | 通过 | 通过 | 通过 | 通过 |
| Star/活跃度时间戳 | 待复核 | 待复核 | 待复核 | 待复核 | 待复核 |
| 公司主体状态 | 未通过 | 未通过 | 未通过 | 未通过 | 未通过 |
| 商业成熟度 | 未通过 | 未通过 | 未通过 | 未通过 | 未通过 |
| 可进入技术架构参考 | 通过 | 通过 | 通过 | 通过 | 通过 |
| 可进入商业竞品结论 | 不通过 | 不通过 | 不通过 | 不通过 | 不通过 |

## 对我们项目的可用范围

### 可以使用

- Dify：Agent Runtime、知识库、Workflow、应用配置台
- Langflow：流程可视化、节点参数、执行链路解释
- Flowise：节点组件注册、凭证隔离、可嵌入 API
- Twenty：CRM 对象模型、线索/公司/联系人/时间线
- Mautic：Lead Scoring、Segment、Campaign 自动化

### 不允许使用

- 不允许说这些公司都仍在正常经营，除非另行核验。
- 不允许用 star 数证明商业成熟度。
- 不允许用 GitHub repo 证明公司主体存续。
- 不允许把未核验公司状态写进 PRD 或对外材料。

## 后续复核任务

正式进入 P1 前，应补齐：

1. 用 GitHub API 记录 star、fork、archived、pushed_at、license。
2. 读取 README、LICENSE、release 页面。
3. 对每个项目的背后公司或维护组织做主体核验。
4. 把无法核验的项目从“标杆”降级为“代码参考”。
5. 对每个可借鉴点至少找到一个对应代码目录或文档页面。

## 来源

- Dify GitHub：https://github.com/langgenius/dify
- Langflow GitHub：https://github.com/langflow-ai/langflow
- Flowise GitHub：https://github.com/FlowiseAI/Flowise
- Twenty GitHub：https://github.com/twentyhq/twenty
- Mautic GitHub：https://github.com/mautic/mautic
