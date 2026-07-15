# 自超滑电机 AIGC 销售 Agent 文献知识库

更新时间：2026-07-13

## 建库目的

本知识库用于支撑“自超滑电机销售拓客 Agent”的技术架构，而不是只做泛 B2B marketing 摘要。

目标功能包括：

```text
潜在客户发现
+ 潜客筛选/排序
+ 自超滑电机产品应用推荐
+ 问诊式销售话术
+ RAG 证据引用
+ Review 审查
```

## 文献分层方法

### Seed papers

已经进入我们研究主线的种子论文：

1. Järvinen, J., & Taiminen, H. (2016). **Harnessing marketing automation for B2B content marketing**. *Industrial Marketing Management, 54*, 164-175.
2. Kaplan, et al. (2025). **A review of AI-based business lead generation: Scrapus as a case study**. *Frontiers in Artificial Intelligence*.

### 一级参考文献

一级参考文献指 seed paper references 中直接引用、且与我们产品架构有关的论文。

### 二级参考文献

二级参考文献指围绕一级文献继续扩展出的高影响力基础文献、综述或方法论文。

### Review 状态

本文区分：

- `已读摘要/正文`：已读取论文摘要或 PDF 正文。
- `来自种子论文参考文献`：已在种子论文 reference list 中出现。
- `待核验引用数`：认为是权威或高影响文献，但具体 Google Scholar citation count 未记录。

## 一、B2B 内容营销与营销自动化

### Seed paper

**Järvinen, J., & Taiminen, H. (2016). Harnessing marketing automation for B2B content marketing. *Industrial Marketing Management, 54*, 164-175.**

作用：

- 把 B2B content marketing、marketing automation、sales funnel、lead nurturing 连接起来。
- 说明 marketing automation 可以通过 behavioral targeting 和 content personalization 生成高质量销售线索。
- 对我们而言，它支撑“销售 Agent 不是单纯写话术，而要根据客户旅程阶段推荐内容和动作”。

### 一级参考文献

1. Holliman, G., & Rowley, J. (2014). **Business to business digital content marketing: Marketers' perceptions of best practice**. *Journal of Research in Interactive Marketing, 8*(4), 269-293.  
   用途：B2B digital content marketing 的定义和 best practice。适合作为内容知识库和话术内容结构的基础。

2. Järvinen, J., & Karjaluoto, H. (2015). **The use of Web analytics for digital marketing performance measurement**. *Industrial Marketing Management, 50*, 117-127.  
   用途：说明 Web analytics 如何用于数字营销绩效测量。对应 Agent 的行为数据和转化反馈。

3. Pulizzi, J. (2012). **The rise of storytelling as the new marketing**. *Publishing Research Quarterly, 28*(2), 116-123.  
   用途：内容营销中的 storytelling 视角。对应话术生成中的“客户场景 + 痛点 + 价值故事”结构。

4. Pulizzi, J., & Handley, A. (2014). **B2B content marketing: 2015 benchmarks, budgets, and trends - North America**. Content Marketing Institute.  
   用途：行业 benchmark，适合做背景材料；不作为学术理论主干。

5. Halligan, B., & Shah, D. (2010). **Inbound Marketing: Get Found Using Google, Social Media, and Blogs**. Hoboken, NJ: Wiley.  
   用途：inbound marketing 经典实践书。对“让潜客主动被内容吸引”有参考价值。

### 二级权威文献

1. Kotler, P., Rackham, N., & Krishnaswamy, S. (2006). **Ending the war between sales and marketing**. *Harvard Business Review, 84*(7/8), 68-78.  
   用途：营销和销售协同的经典文献。对应我们的 CRM + Agent + 跟进任务闭环。

2. Wiersema, F. (2013). **The B2B agenda: The current state of B2B marketing and a look ahead**. *Industrial Marketing Management, 42*(4), 470-488.  
   用途：B2B marketing 的状态和趋势。适合作为行业研究主干。

3. Syam, N., & Sharma, A. (2018). **Waiting for a sales renaissance in the fourth industrial revolution: Machine learning and artificial intelligence in sales research and practice**. *Industrial Marketing Management, 69*, 135-146.  
   用途：AI/ML in sales 的基础综述。支撑销售 Agent 的研究定位。

## 二、Lead Management / Lead Scoring / 销售线索筛选

### 一级参考文献

1. D'Haen, J., & Van den Poel, D. (2013). **Model-supported business-to-business prospect prediction based on an iterative customer acquisition framework**. *Industrial Marketing Management, 42*(4), 544-551.  
   用途：B2B prospect prediction 的核心论文。对应我们的“潜客评分 + 迭代获取客户”模块。

2. D'Haen, J., Van den Poel, D., & Thorleuchter, D. (2013). **Predicting customer profitability during acquisition: Finding the optimal combination of data source and data mining technique**. *Expert Systems with Applications, 40*(6), 2007-2012.  
   用途：比较数据源和数据挖掘技术组合。对应“公司官网、行业标签、CRM 记录、外部网页”等多源融合。

3. Sabnis, G., Chatterjee, S. C., Grewal, R., & Lilien, G. L. (2013). **The sales lead black hole: On sales reps' follow-up of marketing leads**. *Journal of Marketing, 77*(1), 52-67.  
   用途：解释为什么营销线索会在销售跟进中流失。对应 Agent 的跟进提醒、优先级和任务闭环。

4. Monat, J. P. (2011). **Industrial sales lead conversion modeling**. *Marketing Intelligence & Planning, 29*(2), 178-194.  
   用途：工业销售线索转化建模。与自超滑电机这种技术型 B2B 产品高度相关。

5. Jolson, M. A. (1988). **Qualifying sales leads: The tight and loose approaches**. *Industrial Marketing Management, 17*(3), 189-196.  
   用途：销售线索资格判断的早期经典文献。对应我们的 A/B/C/D 线索等级。

6. Jolson, M. A., & Wotruba, T. R. (1992). **Prospecting: A new look at this old challenge**. *Journal of Personal Selling & Sales Management, 12*(4), 59-66.  
   用途：prospecting 的基础文献。对应拓客流程设计。

7. Oldroyd, J. B., McElheran, K., & Elkington, D. (2011). **The short life of online sales leads**. *Harvard Business Review, 89*(3), 28.  
   用途：强调线索响应速度。对应 Agent 的优先触达提醒。

### 二级权威文献

1. Yan, J., Gong, M., Sun, C., Huang, J., & Chu, S. M. (2015). **Sales pipeline win propensity prediction: A regression approach**. arXiv:1502.06229.  
   用途：销售机会赢单倾向预测。对应 P2 阶段的 win propensity 模型。

2. Meyer, A., Glock, K., & Radaschewski, F. (2020). **Planning profitable tours for field sales forces: A unified view on sales analytics and mathematical optimization**. arXiv:2011.14822.  
   用途：销售拜访优先级与路线优化。未来适合线下拜访场景。

3. Sinha, A., et al. (2022). **Joint Dynamic Scoring of Account and Users for B2B Lead Prioritization**. arXiv:2209.14250.  
   用途：同时评分 account 和用户。对我们判断“公司适配度 + 联系人角色”非常关键。

4. Zhang, et al. (2026). **Rethinking Sales Lead Scoring: A Large Language Model-based Hierarchical Preference Ranking Framework**. arXiv:2606.04387.  
   用途：用 LLM 融合结构化 CRM 和非结构化互动记录，进行层级偏好排序。适合 P2/P3。

## 三、B2B Prospecting / Web Lead Generation / 外部线索发现

### Seed paper

**Kaplan, et al. (2025). A review of AI-based business lead generation: Scrapus as a case study. *Frontiers in Artificial Intelligence*.**

作用：

- 给出端到端 B2B web prospecting 架构。
- 包括 focused crawling、information extraction、entity resolution、knowledge graph、ICP matching 和 LLM summaries。

### 一级参考文献

1. Ramakrishnan, C., Patnia, A., Hovy, E., & Burns, G. A. P. C. (2006). **Automatic sales lead generation from Web data**.  
   用途：Web 数据生成销售线索的早期代表工作。

2. Thorleuchter, D., Van den Poel, D., & Prinzie, A. (2012). **Analyzing existing customers' websites to improve the customer acquisition process as well as the profitability prediction in B-to-B marketing**. *Expert Systems with Applications, 39*(3), 2597-2605.  
   用途：分析现有客户网站来改善客户获取和盈利预测。对应我们的“用客户官网抽取行业和痛点”。

3. Chakrabarti, S., van den Berg, M., & Dom, B. (1999). **Focused crawling: A new approach to topic-specific Web resource discovery**. *Computer Networks, 31*(11-16), 1623-1640.  
   用途：聚焦爬虫基础。对应 P2 的行业主题爬虫。

4. Han, M., et al. (2018). **Focused crawling through reinforcement learning**.  
   用途：强化学习聚焦爬虫。P0 不做，P2/P3 可参考。

5. Barlaug, N., & Gulla, J. A. (2021). **Neural networks for entity matching: A survey**. *ACM Transactions on Knowledge Discovery from Data, 15*(3).  
   用途：实体匹配/公司去重。对应线索去重和公司合并。

### 二级权威文献

1. Christen, P. (2012). **Data Matching: Concepts and Techniques for Record Linkage, Entity Resolution, and Duplicate Detection**. Berlin: Springer.  
   用途：实体解析和重复检测基础书。

2. Bizer, C., Heath, T., & Berners-Lee, T. (2009). **Linked Data - The story so far**. *International Journal on Semantic Web and Information Systems, 5*(3), 1-22.  
   用途：Linked Data 基础。对应公司/产品/应用知识图谱。

3. Reimers, N., & Gurevych, I. (2019). **Sentence-BERT: Sentence embeddings using Siamese BERT-networks**. *Proceedings of EMNLP-IJCNLP*, 3982-3992.  
   用途：语义匹配基础。对应 ICP matching 和 RAG retrieval。

## 四、产品推荐 / Guided Selling / 复杂技术产品选型

这一组文献是当前最需要补的，因为自超滑电机不是普通消费品，而是低频、高价值、规格约束强的技术型产品。

### 一级/二级权威文献

1. Burke, R. (2000). **Knowledge-based recommender systems**. In A. Kent (Ed.), *Encyclopedia of Library and Information Systems*.  
   用途：知识型推荐系统基础。适合低频、复杂、冷启动产品。

2. Felfernig, A., Friedrich, G., Jannach, D., & Zanker, M. (2006). **An integrated environment for the development of knowledge-based recommender applications**. *International Journal of Electronic Commerce, 11*(2), 11-34.  
   用途：知识型推荐应用开发环境。对应自超滑电机产品推荐规则库。

3. Felfernig, A., Friedrich, G., Jannach, D., & Zanker, M. (2011). **Developing constraint-based recommenders**. In F. Ricci, L. Rokach, B. Shapira, & P. Kantor (Eds.), *Recommender Systems Handbook*.  
   用途：约束型推荐。对应“转速、负载、接触循环、温升、空间尺寸、证据需求”等约束。

4. Jannach, D., Manzoor, A., Cai, W., & Chen, L. (2020). **A survey on conversational recommender systems**. arXiv:2004.00646.  
   用途：会话推荐系统综述。对应问诊式销售和多轮需求澄清。

5. Gao, C., Lei, W., He, X., de Rijke, M., & Chua, T. S. (2021). **Advances and challenges in conversational recommender systems: A survey**. arXiv:2101.09459.  
   用途：总结 CRS 挑战：偏好提问、多轮策略、对话理解、探索利用、评估。

6. Kostric, I., Balog, K., & Radlinski, F. (2021). **Soliciting user preferences in conversational recommender systems via usage-related questions**. arXiv:2109.05454.  
   用途：使用场景问题优于直接参数问题。对应“不要先问摩擦系数，先问寿命、噪声、温升、维护成本”。

7. Zuo, X., et al. (2022). **Hierarchical conversational preference elicitation with bandit feedback**. arXiv:2203.03922.  
   用途：层级偏好提问。可把“应用主线 -> 部件 -> 痛点 -> 证据需求”做成层级问诊。

8. Manzoor, A., & Jannach, D. (2021). **Towards retrieval-based conversational recommendation**. arXiv:2109.02311.  
   用途：检索式回复可作为生成式 LLM 的补充，降低幻觉。

### 对自超滑电机 Agent 的架构含义

产品推荐层应该采用：

```text
Knowledge-based recommender
+ Constraint-based matcher
+ Conversational preference elicitation
+ RAG evidence retrieval
```

而不是让 LLM 直接生成推荐。

## 五、专业销售话术 / Pre-sales Dialogue / Sales Enablement

### 核心文献

1. Liu, et al. (2023). **When large language models meet e-commerce: Towards better pre-sales dialogue systems**. arXiv:2308.06259.  
   用途：说明 CRS 擅长推荐准确性，LLM 擅长自然语言回复；两者应组合。对应我们的“推荐引擎 + LLM 话术生成”。

2. Liu, et al. (2025). **Optimizing conversational product recommendation via reinforcement learning**. arXiv:2503.02474.  
   用途：对话推荐策略优化。P2 可基于销售反馈优化话术策略。

3. Moncrief, W. C., & Marshall, G. W. (2005). **The evolution of the seven steps of selling**. *Industrial Marketing Management, 34*(1), 13-22.  
   用途：销售步骤演化。对应 Agent 的销售流程结构。

4. Rodriguez, M., Dixon, A. L., & Peltier, J. W. (2014). **A review of the interactive marketing literature in the context of personal selling and sales management**. *Journal of Research in Interactive Marketing, 8*(4), 294-308.  
   用途：互动营销与个人销售。对应多渠道话术生成。

5. Ahearne, M., Hughes, D. E., & Schillewaert, N. (2007). **Why sales reps should welcome information technology: Measuring the impact of CRM-based IT on sales effectiveness**. *International Journal of Research in Marketing, 24*(4), 336-349.  
   用途：CRM-based IT 对销售效果的影响。对应 Agent 与 CRM 时间线整合。

6. Eggert, A., & Serdaroglu, M. (2011). **Exploring the impact of sales technology on salesperson performance: A task-based approach**. *Journal of Marketing Theory and Practice, 19*(2), 169-185.  
   用途：销售技术按任务影响绩效。对应我们按评分、推荐、话术、跟进拆分 Agent 功能。

## 六、RAG / LLM Agent / Review Agent

### 核心文献

1. Lewis, P., Perez, E., Piktus, A., et al. (2020). **Retrieval-augmented generation for knowledge-intensive NLP tasks**. *Advances in Neural Information Processing Systems, 33*, 9459-9474.  
   用途：RAG 基础论文。对应产品资料、论文、官网、案例的证据检索。

2. Devlin, J., Chang, M.-W., Lee, K., & Toutanova, K. (2019). **BERT: Pre-training of deep bidirectional transformers for language understanding**. *Proceedings of NAACL-HLT*, 4171-4186.  
   用途：NER、分类和语义匹配基础。

3. Wang, L., et al. (2023). **A survey on large language model based autonomous agents**. arXiv:2308.11432.  
   用途：LLM agents 的 memory、planning、tool use、evaluation 框架。

4. Guo, T., et al. (2024). **Large language model based multi-agents: A survey of progress and challenges**. arXiv:2402.01680.  
   用途：多 Agent 架构综述。对应 Research / Recommendation / Scoring / Pitch / Review agents。

5. Tang, et al. (2025). **A survey of LLM-driven industry agents: Foundations, applications, and challenges**. arXiv:2505.13061.  
   用途：行业 Agent 的可靠性、安全性、评估要求。

## 七、自超滑 / 摩擦学 / 电机应用证据库

这一组是我们的技术壁垒证据层，服务于“专业话术不能空泛”的要求。

### 核心权威文献

1. Bhushan, B., Israelachvili, J. N., & Landman, U. (1995). **Nanotribology: Friction, wear and lubrication at the atomic scale**. *Nature, 374*, 607-616.  
   用途：纳米摩擦学经典综述。作为超滑/微纳摩擦的基础文献。

2. Hirano, M., Shinjo, K., Kaneko, R., & Murata, Y. (1997). **Observation of superlubricity by scanning tunneling microscopy**. *Physical Review Letters, 78*(8), 1448-1451.  
   用途：超滑实验观察的重要早期论文。

3. Dienwiebel, M., Verhoeven, G. S., Pradeep, N., Frenken, J. W. M., Heimberg, J. A., & Zandbergen, H. W. (2004). **Superlubricity of graphite**. *Physical Review Letters, 92*(12), 126101.  
   用途：石墨超滑经典论文。

4. Socoliuc, A., Gnecco, E., Maier, S., Pfeiffer, O., Baratoff, A., Bennewitz, R., & Meyer, E. (2006). **Atomic-scale control of friction by actuation of nanometer-sized contacts**. *Science, 313*(5784), 207-210.  
   用途：通过激励控制原子尺度摩擦，支撑微纳器件方向。

5. Liu, Z., Yang, J., Grey, F., Liu, J. Z., Liu, Y., Wang, Y., Yang, Y., Cheng, Y., & Zheng, Q. (2012). **Observation of microscale superlubricity in graphite**. *Physical Review Letters, 108*(20), 205503.  
   用途：微米尺度超滑，直接支撑“产业化可能性”的技术叙事。

6. Berman, D., Deshmukh, S. A., Sankaranarayanan, S. K. R. S., Erdemir, A., & Sumant, A. V. (2015). **Macroscale superlubricity enabled by graphene nanoscroll formation**. *Science, 348*(6239), 1118-1122.  
   用途：宏观尺度超滑探索。适合说明超滑从实验室走向工程应用的方向。

7. Holmberg, K., Andersson, P., & Erdemir, A. (2012). **Global energy consumption due to friction in passenger cars**. *Tribology International, 47*, 221-234.  
   用途：摩擦造成能耗的宏观量化。适合销售话术中的“摩擦损耗价值”背景，但不要直接套用到客户设备。

8. Benassi, A., Ma, M., Urbakh, M., & Vanossi, A. (2015). **The breakdown of superlubricity by driving-induced commensurate dislocations**. arXiv:1511.04562.  
   用途：说明超滑失效边界。Review Agent 可用它提醒不要夸大承诺。

## 八、文献到系统模块的映射

| 系统模块 | 关键文献支撑 | 实现含义 |
| --- | --- | --- |
| Source Registry | RAG, Linked Data, Scrapus | 所有官网、论文、专利、案例都要记录来源、时间、可信度 |
| Lead Discovery | Scrapus, focused crawling, D'Haen, Thorleuchter | P1/P2 做半自动 URL 抽取和聚焦爬虫 |
| Lead Scoring | Jolson, D'Haen, Sabnis, Sinha, Zhang | 从单条分数升级为公司分 + 联系人分 + 批量排序 |
| Product Recommendation | Burke, Felfernig, Jannach, Gao | 自超滑电机必须用知识型/约束型推荐 |
| Guided Selling | Kostric, Zuo, CRS surveys | 用场景问诊问题澄清需求 |
| Pitch Generation | Liu 2023, Moncrief, Rodriguez | 推荐引擎出结论，LLM 生成自然话术 |
| Review Agent | RAG, LLM agent surveys, superlubricity failure papers | 检查事实引用、性能数字、夸大承诺 |
| Technical Evidence | Bhushan, Dienwiebel, Liu, Berman, Holmberg | 建立超滑技术可信证据库 |

## 九、下一步建库任务

### P0.5

1. 把本文献库切分成 `source -> chunk -> metadata`。
2. 每条文献建立字段：

```text
title
authors
year
venue
doi_or_url
topic
architecture_module
evidence_type
confidence
review_status
notes
```

3. 将 Järvinen & Taiminen 2016 PDF 作为第一篇本地 PDF source。
4. 将 Frontiers Scrapus 论文作为第二篇 Web source。
5. 将 FrictionX 官网作为官方产品 source。

### P1

1. 为每篇文献抽取：
   - 核心问题
   - 方法
   - 数据
   - 对 Agent 架构的启发
2. 对每条销售话术要求引用至少一个 source。
3. 对每条产品推荐要求给出“证据缺口”。

### P2

1. 建立二级参考文献扩展队列。
2. 加入 citation count 字段。
3. 通过 Google Scholar / Semantic Scholar / Crossref 复核影响力。

## 十、当前缺口

1. 还没有真实 citation count，需要后续用 Google Scholar 或 Semantic Scholar 批量复核。
2. 自超滑电机的具体产品参数、测试数据、客户案例仍需 FrictionX 官方资料补充。
3. 目前文献能支撑“架构设计”，但还不能支撑具体性能承诺。
