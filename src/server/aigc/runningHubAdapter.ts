import {
  AigcActor,
  AigcAdapterJob,
  AigcCreationResponse,
  AigcCreationRequest,
  AigcJobSubmitRequest,
  AigcJobStatus,
  AigcSubmitMode
} from "@/server/aigc/types";
import { getAigcJob, makeAigcJobId, makeAigcProjectId, saveAigcJob } from "@/server/aigc/jobStore";

type RunningHubQueryResponse = {
  taskId?: string;
  status?: string;
  errorCode?: string;
  errorMessage?: string;
  results?: { url?: string; outputType?: string }[];
};

function now() {
  return new Date().toISOString();
}

function makePayloadPreview(request: AigcCreationRequest, plan: AigcCreationResponse) {
  const imageTask = plan.execution.find((item) => item.mode === "text_to_image");
  const videoTasks = plan.execution.filter((item) => item.mode !== "text_to_image");
  return {
    route: "runninghub-standard-model-chain",
    imageStage: {
      model: plan.adapter.imageModel,
      promptLanguage: request.promptLanguage,
      task: imageTask || null
    },
    videoStage: {
      model: plan.adapter.videoModel,
      tasks: videoTasks
    }
  };
}

function makeBaseJob(input: AigcJobSubmitRequest): AigcAdapterJob {
  const timestamp = now();
  return {
    jobId: makeAigcJobId(),
    projectId: makeAigcProjectId(),
    platform: "runninghub",
    status: "draft",
    submitMode: input.submitMode,
    projectTitle: input.plan.projectTitle,
    request: input.request,
    adapter: input.plan.adapter,
    execution: input.plan.execution,
    planSnapshot: input.plan,
    assetApprovals: input.assetApprovals.map((approval) =>
      approval.status === "pending"
        ? approval
        : { ...approval, reviewedAt: timestamp, reviewedBy: input.actor }
    ),
    payloadPreview: makePayloadPreview(input.request, input.plan),
    createdAt: timestamp,
    updatedAt: timestamp,
    logs: [{ at: timestamp, level: "info", message: "已创建可追踪的内容生产任务。" }],
    events: [{ at: timestamp, type: "created", actor: input.actor, message: "已创建可审计的 RunningHub 任务。" }]
  };
}

function areAssetsApproved(job: AigcAdapterJob) {
  return job.assetApprovals.length > 0 && job.assetApprovals.every((approval) => approval.status === "approved");
}

function withEvent(job: AigcAdapterJob, type: AigcAdapterJob["events"][number]["type"], actor: AigcActor, message: string): AigcAdapterJob {
  const timestamp = now();
  return { ...job, updatedAt: timestamp, events: [...job.events, { at: timestamp, type, actor, message }] };
}

function runningHubConfig() {
  return {
    apiKey: process.env.RUNNINGHUB_API_KEY?.trim(),
    submitUrl: process.env.RUNNINGHUB_SUBMIT_URL?.trim(),
    queryUrl: process.env.RUNNINGHUB_QUERY_URL?.trim() || "https://www.runninghub.cn/openapi/v2/query"
  };
}

function appendLog(job: AigcAdapterJob, level: "info" | "warn" | "error", message: string) {
  return {
    ...job,
    updatedAt: now(),
    logs: [...job.logs, { at: now(), level, message }]
  };
}

function evolveMockJob(job: AigcAdapterJob): AigcAdapterJob {
  if (job.submitMode !== "mock" || job.status === "blocked" || job.status === "failed" || job.status === "succeeded") {
    return job;
  }

  const elapsedMs = Date.now() - new Date(job.createdAt).getTime();
  const nextStatus: AigcJobStatus =
    elapsedMs < 4000 ? "mock_queued" : elapsedMs < 12000 ? "mock_running" : "succeeded";

  if (nextStatus === job.status) return job;

  if (nextStatus === "succeeded") {
    return {
      ...job,
      status: "succeeded",
      updatedAt: now(),
      result: {
        remoteStatus: "MOCK_SUCCESS",
        outputs: [
          {
            url: "https://www.runninghub.cn/call-api/search-api/standard-model?search=",
            outputType: "preview-link"
          }
        ]
      },
      logs: [...job.logs, { at: now(), level: "info", message: "内容任务已完成，结果位已保留给生产适配器输出回填。" }]
    };
  }

  const message = nextStatus === "mock_queued" ? "内容任务已进入队列。" : "内容任务正在执行图片首帧与视频链路。";
  return {
    ...job,
    status: nextStatus,
    updatedAt: now(),
    logs: job.logs.at(-1)?.message === message ? job.logs : [...job.logs, { at: now(), level: "info", message }]
  };
}

async function submitLive(job: AigcAdapterJob): Promise<AigcAdapterJob> {
  const config = runningHubConfig();
  if (!config.apiKey || !config.submitUrl) {
    return {
      ...job,
      status: "blocked" as const,
      blocker: "缺少 RUNNINGHUB_API_KEY 或 RUNNINGHUB_SUBMIT_URL，live skeleton 不能实际提交。",
      updatedAt: now(),
      logs: [...job.logs, { at: now(), level: "warn", message: "未找到 live 所需配置，任务被阻塞。" }]
    };
  }

  const response = await fetch(config.submitUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      platform: "runninghub",
      imageModel: job.adapter.imageModel,
      videoModel: job.adapter.videoModel,
      request: job.request,
      execution: job.execution,
      payloadPreview: job.payloadPreview
    })
  });

  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    return {
      ...job,
      status: "failed" as const,
      blocker: String(payload.message || payload.msg || "RunningHub 提交失败"),
      updatedAt: now(),
      logs: [...job.logs, { at: now(), level: "error", message: `live 提交失败：${String(payload.message || payload.msg || response.status)}` }]
    };
  }

  const remoteTaskId =
    typeof payload.taskId === "string"
      ? payload.taskId
      : typeof payload.id === "string"
        ? payload.id
        : typeof payload.data === "object" && payload.data && "taskId" in payload.data
          ? String((payload.data as { taskId?: string }).taskId || "")
          : "";

  return {
    ...job,
    status: "submitted",
    remoteTaskId: remoteTaskId || undefined,
    updatedAt: now(),
    logs: [...job.logs, { at: now(), level: "info", message: remoteTaskId ? `live skeleton 已提交，收到 taskId ${remoteTaskId}。` : "live skeleton 已提交，但响应中没有解析到 taskId。" }]
  };
}

function mapRemoteStatus(status?: string): AigcJobStatus {
  if (!status) return "submitted";
  if (status === "SUCCESS") return "succeeded";
  if (status === "FAILED" || status === "ERROR") return "failed";
  if (status === "RUNNING" || status === "PROCESSING") return "running";
  return "submitted";
}

export async function submitRunningHubJob(input: AigcJobSubmitRequest) {
  let job: AigcAdapterJob = makeBaseJob(input);
  if (!areAssetsApproved(job)) {
    job = withEvent(
      { ...job, status: "awaiting_approval", blocker: "所有资产必须先审批通过，才可以提交到 RunningHub。" },
      "submission_blocked",
      input.actor,
      "提交被资产审批门禁阻止。"
    );
    await saveAigcJob(job);
    return job;
  }
  job =
    input.submitMode === "mock"
      ? {
          ...job,
          status: "mock_queued",
          logs: [...job.logs, { at: now(), level: "info", message: "内容任务已提交，等待生产适配器处理。" }]
        }
      : await submitLive(job);
  job = withEvent(job, "submitted", input.actor, `已请求以 ${input.submitMode} 模式提交任务。`);
  await saveAigcJob(job);
  return job;
}

export async function refreshRunningHubJob(jobId: string) {
  const job = await getAigcJob(jobId);
  if (!job || job.platform !== "runninghub") return job;

  if (job.submitMode === "mock") {
    const evolved = evolveMockJob(job);
    await saveAigcJob(evolved);
    return evolved;
  }

  if (!job.remoteTaskId) return job;

  const config = runningHubConfig();
  if (!config.apiKey) {
    const blocked = appendLog({ ...job, status: "blocked", blocker: "缺少 RUNNINGHUB_API_KEY，无法查询远端状态。" }, "warn", "状态刷新被阻塞。");
    await saveAigcJob(blocked);
    return blocked;
  }

  const response = await fetch(config.queryUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ taskId: job.remoteTaskId })
  });

  const payload = (await response.json().catch(() => ({}))) as RunningHubQueryResponse & { message?: string };
  if (!response.ok) {
    const failed = appendLog(
      { ...job, status: "failed", blocker: payload.message || "查询远端任务状态失败。" },
      "error",
      `状态查询失败：${payload.message || response.status}`
    );
    await saveAigcJob(failed);
    return failed;
  }

  const next: AigcAdapterJob = {
    ...job,
    status: mapRemoteStatus(payload.status),
    updatedAt: now(),
    result: payload.results
      ? {
          remoteStatus: payload.status,
          outputs: payload.results
            .filter((item) => item.url)
            .map((item) => ({ url: item.url || "", outputType: item.outputType || "unknown" }))
        }
      : job.result,
    blocker: payload.errorMessage || job.blocker,
    logs: [...job.logs, { at: now(), level: "info", message: `已刷新 RunningHub 远端状态：${payload.status || "unknown"}` }]
  };
  await saveAigcJob(next);
  return next;
}
