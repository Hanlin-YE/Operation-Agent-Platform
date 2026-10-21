import { database, dataDirectory } from "@/server/storage/database";
import path from "path";
import { AigcAdapterJob } from "@/server/aigc/types";
import { makeId } from "@/server/data/store";

const memoryStoreKey = "__AIGC_JOB_STORE__";

type GlobalStore = typeof globalThis & {
  [memoryStoreKey]?: AigcAdapterJob[];
};

function shouldUseMemoryStore() {
  return process.env.CLOUDFLARE === "true" || process.env.DEMO_EPHEMERAL_STORE === "true";
}

function ensureStore() {
  database().migrate("aigc", path.join(dataDirectory(), "aigc-jobs.json"), { jobs: [] }, undefined, (jobs) => {
    if (!Array.isArray(jobs)) throw new Error("AIGC 旧任务数据结构无效");
    return { jobs };
  });
}
const snapshots = new WeakMap<AigcAdapterJob[], {jobs: AigcAdapterJob[]}>();

function getMemoryStore() {
  const host = globalThis as GlobalStore;
  if (!host[memoryStoreKey]) {
    host[memoryStoreKey] = [];
  }
  return host[memoryStoreKey];
}

export async function readAigcJobs() {
  if (shouldUseMemoryStore()) {
    return structuredClone(getMemoryStore()) as AigcAdapterJob[];
  }

  await ensureStore();
  const data = database().read<{jobs: AigcAdapterJob[]}>("aigc");
  snapshots.set(data.jobs, data);
  return data.jobs;
}

export async function writeAigcJobs(jobs: AigcAdapterJob[]) {
  if (shouldUseMemoryStore()) {
    const host = globalThis as GlobalStore;
    host[memoryStoreKey] = structuredClone(jobs) as AigcAdapterJob[];
    return;
  }

  await ensureStore();
  const data = snapshots.get(jobs);
  if (!data) throw new Error("保存 AIGC 任务需要数据库快照");
  database().write("aigc", data);
}

export async function saveAigcJob(job: AigcAdapterJob) {
  const jobs = await readAigcJobs();
  const index = jobs.findIndex(item => item.jobId === job.jobId);
  if (index >= 0) jobs[index] = job; else jobs.unshift(job);
  await writeAigcJobs(jobs);
  return job;
}

export async function getAigcJob(jobId: string) {
  const jobs = await readAigcJobs();
  return jobs.find((job) => job.jobId === jobId) || null;
}

export async function listAigcJobs() {
  const jobs = await readAigcJobs();
  return jobs.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function makeAigcJobId() {
  return makeId("aigc-job");
}

export function makeAigcProjectId() {
  return makeId("aigc-project");
}
