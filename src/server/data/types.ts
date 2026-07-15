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

export type AppData = {
  leads: Lead[];
  products: Product[];
  knowledge: KnowledgeDocument[];
  scores: LeadScore[];
  pitches: GeneratedPitch[];
  followUps: FollowUp[];
};
