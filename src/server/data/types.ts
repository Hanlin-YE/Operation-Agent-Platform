export type LeadStatus =
  | "new"
  | "to_follow"
  | "contacted"
  | "interested"
  | "invalid"
  | "deferred";

export type PitchChannel =
  | "phone"
  | "wechat"
  | "email"
  | "quote_followup"
  | "price_objection"
  | "technical_confirm";

export type Lead = {
  id: string;
  companyName: string;
  industry: string;
  region: string;
  companySize: string;
  contactName: string;
  contactTitle: string;
  contactMethod: string;
  source: string;
  status: LeadStatus;
  tags: string[];
  accountTier: "KA" | "LA" | "SMB";
  routingPolicy: "HUMAN_REQUIRED" | "HUMAN_APPROVAL" | "NURTURE_AUTOMATION";
  tierReason: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type Product = {
  id: string;
  name: string;
  model: string;
  category: string;
  powerRange: string;
  voltage: string;
  speed: string;
  torque: string;
  protectionLevel: string;
  useCases: string[];
  sellingPoints: string[];
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type KnowledgeDocument = {
  id: string;
  title: string;
  type: "product" | "case" | "objection" | "selection" | "faq";
  content: string;
  sourceFile?: string;
  createdAt: string;
  updatedAt: string;
};

export type LeadScore = {
  id: string;
  leadId: string;
  totalScore: number;
  grade: "A" | "B" | "C" | "D";
  industryScore: number;
  useCaseScore: number;
  companyFitScore: number;
  contactScore: number;
  urgencyScore: number;
  riskPenalty: number;
  reasons: string[];
  recommendedAction: string;
  modelVersion: string;
  createdAt: string;
};

export type GeneratedPitch = {
  id: string;
  leadId: string;
  productId?: string;
  channel: PitchChannel;
  scenario: string;
  content: string;
  rationale: string;
  citations: string[];
  createdAt: string;
};

export type FollowUp = {
  id: string;
  leadId: string;
  pitchId?: string;
  type: "call" | "wechat" | "email" | "meeting" | "note";
  content: string;
  nextActionAt?: string;
  status: "open" | "done";
  createdAt: string;
};

export type MarketFocus =
  | "all"
  | "robotics"
  | "medical"
  | "industrial"
  | "automotive"
  | "aerospace";

export type MarketEvidenceLabel = "企业知识" | "公开资料" | "推断" | "待市场验证";

export type MarketSegment = {
  id: string;
  name: string;
  typicalCustomers: string[];
  demandDrivers: string[];
  painPoints: string[];
  productFit: "高" | "中" | "待验证";
  marketPriority: "P0" | "P1" | "P2";
  evidenceLabel: MarketEvidenceLabel;
  evidence: string[];
  recommendedEntry: string;
  openQuestions: string[];
};

export type CompetitorWatchItem = {
  category: string;
  marketSignal: string;
  implication: string;
  evidenceLabel: MarketEvidenceLabel;
};

/**
 * 统一的小红书公开内容信号。来源可替换为真实服务，但市场 Agent 只依赖此契约。
 * 第一版由本地 mock 提供，绝不在浏览器或服务端直接调用平台 API。
 */
export type XiaohongshuSignal = {
  id: string;
  accountName: string;
  accountType: "企业" | "团队" | "个人开发者" | "待核验";
  title: string;
  noteUrl: string;
  profileUrl: string;
  publishedAt: string;
  scenario: MarketFocus;
  signalType: "需求表达" | "痛点表达" | "竞品评论" | "场景观察";
  excerpt: string;
  intentLevel: "高" | "中" | "低";
  evidenceLabel: "公开资料" | "推断";
  recommendedAction: string;
};

export type MarketAnalysisReport = {
  id: string;
  focus: MarketFocus;
  title: string;
  executiveSummary: string;
  segments: MarketSegment[];
  competitorWatch: CompetitorWatchItem[];
  recommendedActions: string[];
  openQuestions: string[];
  knowledgeCitations: string[];
  xiaohongshuSignals: XiaohongshuSignal[];
  sourceStatus: {
    xiaohongshu: "本地演示数据" | "未配置";
    note: string;
  };
  modelVersion: string;
  createdAt: string;
};

export type AppData = {
  leads: Lead[];
  products: Product[];
  knowledge: KnowledgeDocument[];
  scores: LeadScore[];
  pitches: GeneratedPitch[];
  followUps: FollowUp[];
  marketReports: MarketAnalysisReport[];
};
