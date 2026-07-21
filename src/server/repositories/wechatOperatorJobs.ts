import { WechatOperatorJob } from "@/server/data/types";
import { makeId, readData, writeData } from "@/server/data/store";
import { ingestWechatComments } from "@/server/repositories/wechatComments";

export async function listWechatOperatorJobs() {
  return [...((await readData()).wechatOperatorJobs || [])].sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));
}

export async function createWechatOperatorJob(input: Pick<WechatOperatorJob, "articleQuery" | "dateFrom" | "dateTo" | "maxPages" | "requestedBy">) {
  const data = await readData(); const job: WechatOperatorJob = { id: makeId("wechat-job"), status: "queued", articleQuery: input.articleQuery.trim(), dateFrom: input.dateFrom, dateTo: input.dateTo, maxPages: Math.max(1, Math.min(input.maxPages, 20)), requestedBy: input.requestedBy, requestedAt: new Date().toISOString(), leadCreation: "disabled" };
  data.wechatOperatorJobs = [job, ...(data.wechatOperatorJobs || [])]; await writeData(data); return job;
}

export async function completeWechatOperatorJob(id: string, payload: Parameters<typeof ingestWechatComments>[0]) {
  const data = await readData(); const index = data.wechatOperatorJobs?.findIndex((item) => item.id === id) ?? -1;
  if (index < 0 || !data.wechatOperatorJobs) throw new Error("采集任务不存在");
  if (data.wechatOperatorJobs[index].status === "completed") throw new Error("采集任务已完成，禁止重复回传");
  data.wechatOperatorJobs[index] = { ...data.wechatOperatorJobs[index], status: "running" }; await writeData(data);
  try {
    const result = await ingestWechatComments(payload); const latest = await readData(); const latestIndex = latest.wechatOperatorJobs?.findIndex((item) => item.id === id) ?? -1;
    if (latestIndex < 0 || !latest.wechatOperatorJobs) throw new Error("采集任务不存在");
    const job = { ...latest.wechatOperatorJobs[latestIndex], status: "completed" as const, completedAt: new Date().toISOString(), inserted: result.inserted, duplicates: result.duplicates };
    latest.wechatOperatorJobs[latestIndex] = job; await writeData(latest); return { job, result };
  } catch (error) {
    const latest = await readData(); const latestIndex = latest.wechatOperatorJobs?.findIndex((item) => item.id === id) ?? -1;
    if (latestIndex >= 0 && latest.wechatOperatorJobs) { latest.wechatOperatorJobs[latestIndex] = { ...latest.wechatOperatorJobs[latestIndex], status: "failed", error: error instanceof Error ? error.message : "回传失败" }; await writeData(latest); }
    throw error;
  }
}
