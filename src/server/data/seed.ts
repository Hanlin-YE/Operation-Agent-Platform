import { AppData } from "./types";
import { frictionXCatalog } from "./frictionxCatalog";

const now = new Date().toISOString();

export const seedData: AppData = {
  leads: [
    {
      id: "lead-1",
      companyName: "苏州恒远智能装备有限公司",
      industry: "自动化设备",
      region: "江苏苏州",
      companySize: "200-500人",
      contactName: "周经理",
      contactTitle: "采购经理",
      contactMethod: "zhou@example.com / 13800000001",
      source: "展会名单",
      status: "new",
      tags: ["设备厂", "输送线", "高潜"],
      accountTier: "LA",
      routingPolicy: "HUMAN_APPROVAL",
      tierReason: "本地 B 端演示账户。",
      notes: "主营非标自动化产线和输送线集成，近期扩产，关注交期和稳定性。",
      createdAt: now,
      updatedAt: now
    },
    {
      id: "lead-2",
      companyName: "青岛海川泵业股份有限公司",
      industry: "泵阀设备",
      region: "山东青岛",
      companySize: "500-1000人",
      contactName: "李工",
      contactTitle: "技术选型工程师",
      contactMethod: "li@example.com / 13800000002",
      source: "官网询盘",
      status: "to_follow",
      tags: ["泵用电机", "技术选型"],
      accountTier: "SMB",
      routingPolicy: "NURTURE_AUTOMATION",
      tierReason: "标准化培育演示账户。",
      notes: "询问高效节能电机替换方案，关注能效等级、温升和防护等级。",
      createdAt: now,
      updatedAt: now
    },
    {
      id: "lead-3",
      companyName: "佛山锐达贸易有限公司",
      industry: "贸易流通",
      region: "广东佛山",
      companySize: "20-50人",
      contactName: "陈先生",
      contactTitle: "销售",
      contactMethod: "chen@example.com / 13800000003",
      source: "手工录入",
      status: "deferred",
      tags: ["贸易商", "价格敏感"],
      accountTier: "SMB",
      routingPolicy: "NURTURE_AUTOMATION",
      tierReason: "标准化培育演示账户。",
      notes: "主要询低价通用电机，需求不稳定，多次比价。",
      createdAt: now,
      updatedAt: now
    }
  ],
  products: frictionXCatalog,
  companyPersonas: [
    {
      id: "persona-shandong-shanbo-motor",
      companyName: "山东山博电机集团有限公司",
      aliases: ["山博电机", "山东山博电机集团", "山博电机集团"],
      source: "tianyancha",
      sourceUrl: "https://www.tianyancha.com/company/486798749",
      industry: "电机及工业电气装备制造",
      region: "山东",
      businessSummary: "基于用户提供的天眼查企业主体信息蒸馏：该企业可作为山东区域电机制造企业/集团型制造主体进行销售训练。训练时应将其视为关注电机产品、制造交付、质量一致性、客户应用场景和供应链可靠性的工业客户或同业合作对象。除公司名称与来源链接外，具体经营数据、联系人、营收、客户名单、证书和法律信息均未在本系统内核验。",
      likelyNeeds: [
        "提升电机产品在高端场景中的差异化竞争力",
        "围绕可靠性、寿命、能效、噪声、温升等指标寻找技术补强点",
        "评估新型电机平台、控制方案或配套部件在细分应用中的适配性",
        "稳定供应、质量一致性、批量交付和售后响应",
        "面向工业客户时需要更清晰的产品价值表达与场景化方案"
      ],
      painPoints: [
        "传统电机产品容易陷入价格竞争，差异化卖点需要更强技术证据支撑",
        "客户工况分散，选型与方案验证周期可能较长",
        "对新材料、新结构或新电机平台会关注可靠性、量产一致性和验证成本",
        "工业客户采购通常同时比较性能、价格、交付、售后与长期稳定性",
        "如果涉及高端应用，需要谨慎确认参数、测试标准和样机验证边界"
      ],
      buyingCommittee: [
        "技术/研发负责人：关注结构、性能、验证方法和应用适配",
        "采购/供应链负责人：关注成本、交期、供货稳定性和供应商风险",
        "销售/市场负责人：关注差异化卖点、客户案例、行业进入角度和竞品对比",
        "经营/管理层：关注投入产出、战略协同、量产风险和长期合作价值"
      ],
      conversationStyle: "以制造业客户的审慎、务实、重验证风格回应。先确认应用场景、工况参数、目标客户和验证周期，再讨论产品价值；对未经核验的数据保持保守，不轻易接受泛泛卖点。",
      qualificationQuestions: [
        "贵司希望切入的是哪类电机应用或下游场景？",
        "当前客户最关注的是寿命、能效、噪声、温升、体积重量还是交付稳定性？",
        "是否已有明确的目标参数、测试标准和样机验证计划？",
        "贵司更希望补强核心电机平台、控制方案，还是面向客户的整体解决方案表达？",
        "如果做联合验证，贵司内部通常由技术、采购还是销售市场先推动？"
      ],
      salesAngles: [
        "从自超滑低摩擦与空心杯电机平台切入，强调高端场景中的效率、寿命和稳定性假设，但需以样机测试验证",
        "围绕人形机器人、高端医疗设备、消费无人机、手持云台、激光雷达等场景讨论潜在合作或技术交流",
        "用‘产品差异化 + 场景验证 + 供应稳定’的框架，而不是只谈单点参数",
        "建议先推动技术交流和小范围样机验证，再进入商务报价",
        "针对同业或产业链客户，优先探索互补合作、联合方案或特定细分客户的应用验证"
      ],
      cautions: [
        "不要编造该企业营收、规模、联系人、客户名单、证书、诉讼或招投标信息",
        "除公司名称和用户提供的天眼查链接外，其他内容均作为销售训练画像或销售假设使用",
        "不要承诺 Friction X 产品已适配该企业现有产品线，必须通过工况参数与样机验证确认",
        "避免把该企业描述成已经有采购意向或既有合作关系",
        "如客户追问硬事实，应提示需要进一步核验公开资料或由人工补充企业信息"
      ],
      createdAt: now,
      updatedAt: now
    }
  ],
  knowledge: [
    {
      id: "knowledge-1",
      title: "泵用电机选型要点",
      type: "selection",
      content:
        "泵用电机重点关注功率余量、连续运行稳定性、能效等级、温升、防护等级和安装尺寸。对节能改造客户，应突出长期电费节省、替换兼容性和售后响应。",
      createdAt: now,
      updatedAt: now
    },
    {
      id: "knowledge-2",
      title: "价格异议处理 SOP",
      type: "objection",
      content:
        "客户强调价格高时，不要直接降价。先确认工况、运行时长、故障停机成本和能耗成本，再用总拥有成本解释高效电机的长期价值，并提供阶梯报价或样机测试方案。",
      createdAt: now,
      updatedAt: now
    },
    {
      id: "knowledge-3",
      title: "自动化设备客户沟通案例",
      type: "case",
      content:
        "自动化设备厂通常关注交期、批量一致性、调速性能和售后响应。首次沟通应围绕产线稳定性、变频适配、安装尺寸兼容和项目交付周期展开。",
      createdAt: now,
      updatedAt: now
    }
  ],
  scores: [],
  pitches: [],
  followUps: [],
  marketReports: []
};
