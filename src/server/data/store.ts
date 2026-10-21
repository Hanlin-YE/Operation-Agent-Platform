import { database, dataDirectory } from "@/server/storage/database";
import { AppData } from "./types";
import { seedData } from "./seed";
import path from "path";

const memoryStoreKey = "__MOTOR_SALES_AGENT_STORE__";

type GlobalStore = typeof globalThis & {
  [memoryStoreKey]?: AppData;
};

function cloneSeedData() {
  return structuredClone(seedData) as AppData;
}

function shouldUseMemoryStore() {
  return process.env.CLOUDFLARE === "true" || process.env.DEMO_EPHEMERAL_STORE === "true";
}

function getMemoryStore() {
  const storeHost = globalThis as GlobalStore;
  if (!storeHost[memoryStoreKey]) {
    storeHost[memoryStoreKey] = cloneSeedData();
  }
  return storeHost[memoryStoreKey];
}

function ensureStore() {
  database().migrate("app", path.join(dataDirectory(), "app-data.json"), seedData, (data) => {
    for (const key of ["leads", "products", "knowledge", "scores", "pitches", "followUps", "marketReports"]) {
      if (!Array.isArray(data[key])) throw new Error(`旧业务数据缺少集合：${key}`);
    }
  });
}

export async function readData(): Promise<AppData> {
  if (shouldUseMemoryStore()) {
    return structuredClone(getMemoryStore()) as AppData;
  }

  await ensureStore();
  return database().read<AppData>("app");
}

export async function writeData(data: AppData) {
  if (shouldUseMemoryStore()) {
    const storeHost = globalThis as GlobalStore;
    storeHost[memoryStoreKey] = structuredClone(data) as AppData;
    return;
  }

  await ensureStore();
  database().write("app", data);
}

export function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
