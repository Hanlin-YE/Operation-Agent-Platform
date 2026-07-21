import { promises as fs } from "fs";
import path from "path";
import { seedContentOperationsData } from "./seed";
import { ContentOperationsData, ContentOperationsStorageInfo } from "./types";

const dataFile = path.join(process.cwd(), "data", "content-operations.json");
const memoryStoreKey = "__CONTENT_OPERATIONS_STORE__";

type ContentOperationsGlobal = typeof globalThis & {
  [memoryStoreKey]?: ContentOperationsData;
};

let mutationQueue = Promise.resolve();

function cloneData(data: ContentOperationsData) {
  return structuredClone(data) as ContentOperationsData;
}

export function usesContentOperationsMemoryStore() {
  return process.env.CLOUDFLARE === "true" || process.env.DEMO_EPHEMERAL_STORE === "true";
}

export function getContentOperationsStorageInfo(): ContentOperationsStorageInfo {
  if (usesContentOperationsMemoryStore()) {
    return {
      mode: "memory",
      durable: false,
      warning: "演示数据仅保存在当前运行实例中，冷启动、重新部署或切换实例后可能重置。",
    };
  }
  return { mode: "file", durable: true, warning: null };
}

function getMemoryStore() {
  const host = globalThis as ContentOperationsGlobal;
  if (!host[memoryStoreKey]) {
    host[memoryStoreKey] = cloneData(seedContentOperationsData);
  }
  return host[memoryStoreKey];
}

async function writeFileAtomically(data: ContentOperationsData) {
  await fs.mkdir(path.dirname(dataFile), { recursive: true });
  const temporaryFile = `${dataFile}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(temporaryFile, JSON.stringify(data, null, 2), "utf8");
  await fs.rename(temporaryFile, dataFile);
}

async function ensureFileStore() {
  try {
    await fs.access(dataFile);
  } catch {
    await writeFileAtomically(seedContentOperationsData);
  }
}

export async function readContentOperationsData(): Promise<ContentOperationsData> {
  if (usesContentOperationsMemoryStore()) {
    return cloneData(getMemoryStore());
  }

  await ensureFileStore();
  const raw = await fs.readFile(dataFile, "utf8");
  const data = JSON.parse(raw) as ContentOperationsData;
  if (data.schemaVersion !== 1) {
    throw new Error(`unsupported content operations schema version: ${String(data.schemaVersion)}`);
  }
  return data;
}

export async function writeContentOperationsData(data: ContentOperationsData) {
  if (usesContentOperationsMemoryStore()) {
    const host = globalThis as ContentOperationsGlobal;
    host[memoryStoreKey] = cloneData(data);
    return;
  }
  await writeFileAtomically(data);
}

export function mutateContentOperationsData<T>(
  mutation: (data: ContentOperationsData) => T | Promise<T>,
): Promise<T> {
  const task = mutationQueue.then(async () => {
    const data = await readContentOperationsData();
    const result = await mutation(data);
    await writeContentOperationsData(data);
    return result;
  });
  mutationQueue = task.then(() => undefined, () => undefined);
  return task;
}
