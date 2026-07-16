export type AigcPlatform = "tapnow" | "runninghub" | "generic";

export type AigcVideoType =
  | "product_ad"
  | "product_showcase"
  | "brand_intro"
  | "xiaohongshu";

export type PromptLanguage = "zh" | "en" | "bilingual";

export type AigcCreationRequest = {
  requirement: string;
  platform: AigcPlatform;
  videoType: AigcVideoType;
  durationSec: number;
  aspectRatio: "16:9" | "9:16" | "1:1";
  styleTone: string;
  promptLanguage: PromptLanguage;
};

export type AigcLayerSummary = {
  id: string;
  name: string;
  purpose: string;
  output: string;
};

export type AigcAssetItem = {
  assetId: string;
  type: "style" | "character" | "scene" | "product" | "prop";
  name: string;
  approvalGate: string;
  promptHint: string;
};

export type AigcShotSpec = {
  shotId: string;
  goal: string;
  durationSec: number;
  visualFocus: string;
  prompt: string;
  requiredAssets: string[];
};

export type AigcExecutionSpec = {
  shotId: string;
  mode: "text_to_image" | "image_to_video" | "text_to_video";
  adapterAction: string;
  payload: Record<string, string | number | string[]>;
};

export type AigcAdapterPlan = {
  platform: AigcPlatform;
  submissionMode: "official_api" | "web_adapter" | "manual_handoff";
  standardModelUrl?: string;
  imageModel: string;
  videoModel: string;
  modelNote?: string;
  capabilityRoute: string[];
  operatorChecklist: string[];
  fallbackPolicy: string;
};

export type AigcCreationResponse = {
  projectTitle: string;
  summary: string;
  layers: AigcLayerSummary[];
  brief: {
    audience: string;
    deliverable: string;
    successSignal: string;
  };
  assets: AigcAssetItem[];
  shots: AigcShotSpec[];
  execution: AigcExecutionSpec[];
  adapter: AigcAdapterPlan;
};

export type AigcSubmitMode = "mock" | "live";

export type AigcJobStatus =
  | "draft"
  | "awaiting_approval"
  | "blocked"
  | "submitted"
  | "running"
  | "succeeded"
  | "failed"
  | "mock_queued"
  | "mock_running";

export type AigcJobLog = {
  at: string;
  level: "info" | "warn" | "error";
  message: string;
};

export type AigcActor = {
  id: string;
  role: "operator" | "system";
};

export type AigcAssetApprovalStatus = "pending" | "approved" | "rejected";

export type AigcAssetApproval = {
  assetId: string;
  status: AigcAssetApprovalStatus;
  reviewedAt?: string;
  reviewedBy?: AigcActor;
  note?: string;
};

export type AigcJobEvent = {
  at: string;
  type: "created" | "approval_updated" | "submission_blocked" | "submitted" | "status_refreshed";
  actor: AigcActor;
  message: string;
};

export type AigcJobResult = {
  remoteStatus?: string;
  outputs: { url: string; outputType: string }[];
};

export type AigcAdapterJob = {
  jobId: string;
  projectId: string;
  platform: AigcPlatform;
  status: AigcJobStatus;
  submitMode: AigcSubmitMode;
  projectTitle: string;
  request: AigcCreationRequest;
  adapter: AigcAdapterPlan;
  execution: AigcExecutionSpec[];
  assetApprovals: AigcAssetApproval[];
  payloadPreview: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  remoteTaskId?: string;
  blocker?: string;
  result?: AigcJobResult;
  logs: AigcJobLog[];
  events: AigcJobEvent[];
};

export type AigcJobSubmitRequest = {
  request: AigcCreationRequest;
  plan: AigcCreationResponse;
  submitMode: AigcSubmitMode;
  assetApprovals: AigcAssetApproval[];
  actor: AigcActor;
};
