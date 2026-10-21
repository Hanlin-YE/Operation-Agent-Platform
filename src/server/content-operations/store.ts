import { database, dataDirectory } from "@/server/storage/database";
import path from "path";
import { seedContentOperationsData } from "./seed";
import { ContentOperationsData, ContentOperationsStorageInfo } from "./types";

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
  return { mode: "sqlite", durable: true, warning: null };
}

function getMemoryStore() {
  const host = globalThis as ContentOperationsGlobal;
  if (!host[memoryStoreKey]) {
    host[memoryStoreKey] = cloneData(seedContentOperationsData);
  }
  return host[memoryStoreKey];
}

function ensureFileStore() {
  database().migrate("content", path.join(dataDirectory(), "content-operations.json"), seedContentOperationsData, (data) => {
    if (data.schemaVersion !== 1) throw new Error("内容数据版本不受支持");
  });
}

export async function readContentOperationsData(): Promise<ContentOperationsData> {
  if (usesContentOperationsMemoryStore()) {
    return cloneData(getMemoryStore());
  }

  await ensureFileStore();
  return database().read<ContentOperationsData>("content");
}

export async function writeContentOperationsData(data: ContentOperationsData) {
  if (usesContentOperationsMemoryStore()) {
    const host = globalThis as ContentOperationsGlobal;
    host[memoryStoreKey] = cloneData(data);
    return;
  }
  ensureFileStore();
  database().write("content", data);
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
