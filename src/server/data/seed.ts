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
  followUps: []
};
