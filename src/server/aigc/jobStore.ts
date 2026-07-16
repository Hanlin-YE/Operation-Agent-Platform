import { promises as fs } from "fs";
import path from "path";
import { AigcAdapterJob } from "@/server/aigc/types";
import { makeId } from "@/server/data/store";

const jobsFile = path.join(process.cwd(), "data", "aigc-jobs.json");
const memoryStoreKey = "__AIGC_JOB_STORE__";

type GlobalStore = typeof globalThis & {
  [memoryStoreKey]?: AigcAdapterJob[];
};

function shouldUseMemoryStore() {
  return process.env.CLOUDFLARE === "true" || process.env.DEMO_EPHEMERAL_STORE === "true";
}

async function ensureStore() {
  await fs.mkdir(path.dirname(jobsFile), { recursive: true });
  try {
    await fs.access(jobsFile);
  } catch {
    await fs.writeFile(jobsFile, "[]", "utf8");
  }
}

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
  const raw = await fs.readFile(jobsFile, "utf8");
  return JSON.parse(raw) as AigcAdapterJob[];
}

export async function writeAigcJobs(jobs: AigcAdapterJob[]) {
  if (shouldUseMemoryStore()) {
    const host = globalThis as GlobalStore;
    host[memoryStoreKey] = structuredClone(jobs) as AigcAdapterJob[];
    return;
  }

  await ensureStore();
  const temporaryFile = `${jobsFile}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(temporaryFile, JSON.stringify(jobs, null, 2), "utf8");
  await fs.rename(temporaryFile, jobsFile);
}

export async function saveAigcJob(job: AigcAdapterJob) {
  const jobs = await readAigcJobs();
  const next = [job, ...jobs.filter((item) => item.jobId !== job.jobId)].slice(0, 50);
  await writeAigcJobs(next);
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
