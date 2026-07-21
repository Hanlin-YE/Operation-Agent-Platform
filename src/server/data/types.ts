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

export type KnowledgeVectorChunk = {
  id: string;
  knowledgeId: string;
  sourceTitle: string;
  pageNumber: number;
  text: string;
  embedding: number[];
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
  evidence?: string;
  reason?: string;
  followupStatus?: "待联系" | "已联系" | "跟进中" | "无效";
  sourceName?: string;
  sourceStatus?: "授权接口返回" | "待来源核验" | "演示数据";
  collectedAt?: string;
};

export type PublicSourceMode = "授权公开数据" | "未配置" | "接口异常" | "本地演示数据" | "本地真实数据";

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
  xiaohongshuSignals?: XiaohongshuSignal[];
  sourceStatus?: { xiaohongshu: PublicSourceMode; note: string };
  modelVersion: string;
  createdAt: string;
};

export type LearningCategory = "product" | "market" | "script";
export type LearningMessage = { id: string; role: "learner" | "coach"; content: string; createdAt: string };
export type LearningConversation = { id: string; title: string; category?: LearningCategory; messages: LearningMessage[]; createdAt: string; updatedAt: string };

export type ContentStrategyPlatform = "xiaohongshu" | "wechat" | "douyin" | "other";
export type ContentStrategyStatus = "model_not_configured" | "needs_review" | "approved" | "error" | "superseded" | "rework_pending" | "rework_processing" | "rework_failed";
export type ContentStrategyImage = { filename: string; mimeType: string; size: number };
export type ContentStrategyMetrics = { views?: number; likes?: number; comments?: number; saves?: number; shares?: number };
export type ContentStrategyPack = {
  id: string;
  status: ContentStrategyStatus;
  sample: { platform: ContentStrategyPlatform; title: string; content: string; sourceUrl?: string; metrics: ContentStrategyMetrics; images: ContentStrategyImage[] };
  analysis?: {
    confidence: "high" | "medium" | "low";
    missingData: string[];
    evidence: string[];
    hook: string;
    structure: string[];
    rhythm: string;
    audience: string;
    reusableMethods: string[];
    b2bRisks: string[];
    evidenceRequirements: string[];
    recommendations: { wechat: string; xhsImage: string; xhsVideo: string };
  };
  error?: string;
  review?: { operator: string; note?: string; reviewedAt: string };
  productionConfirmation?: { operator: string; confirmedAt: string };
  productionDraft?: { createdAt: string; invalidatedAt?: string };
  version: number;
  parentId?: string;
  rework?: { operator: string; stage: "strategy_review" | "production_confirmation" | "production_draft"; reason: string; requestedAt: string; targetVersion?: number };
  createdAt: string;
  updatedAt: string;
};

export type WechatCommentStatus = "visible" | "hidden" | "deleted" | "selected";
export type WechatArticle = { id: string; title: string; publishedAt: string; url?: string; commentEnabled?: boolean; syncedAt: string };
export type WechatComment = { id: string; articleId: string; parentCommentId?: string; content: string; createdAt: string; status: WechatCommentStatus; syncedAt: string };
export type CommentAnalysis = { commentId: string; themes: string[]; sentiment: "positive" | "neutral" | "negative"; signals: ("潜在线索" | "投诉风险" | "技术问题")[]; generatedAt: string; model: "rules-v1" };
export type CommentSyncRun = { id: string; source: "local_import" | "official_api"; articleId: string; cursor?: string; inserted: number; duplicates: number; status: "success" | "failed"; error?: string; createdAt: string };
export type WechatOperatorJob = {
  id: string; status: "queued" | "running" | "completed" | "failed"; articleQuery: string; dateFrom?: string; dateTo?: string; maxPages: number;
  requestedBy: string; requestedAt: string; completedAt?: string; inserted?: number; duplicates?: number; error?: string; leadCreation: "disabled";
};

export type AppData = {
  leads: Lead[];
  products: Product[];
  knowledge: KnowledgeDocument[];
  knowledgeChunks?: KnowledgeVectorChunk[];
  scores: LeadScore[];
  pitches: GeneratedPitch[];
  followUps: FollowUp[];
  marketReports: MarketAnalysisReport[];
  contentStrategies?: ContentStrategyPack[];
  learningConversations?: LearningConversation[];
  wechatArticles?: WechatArticle[];
  wechatComments?: WechatComment[];
  commentAnalyses?: CommentAnalysis[];
  commentSyncRuns?: CommentSyncRun[];
  wechatOperatorJobs?: WechatOperatorJob[];
};
