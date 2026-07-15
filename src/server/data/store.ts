import { AppData } from "./types";
import { seedData } from "./seed";
import { promises as fs } from "fs";
import path from "path";

const dataFile = path.join(process.cwd(), "data", "app-data.json");
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

async function ensureStore() {
  await fs.mkdir(path.dirname(dataFile), { recursive: true });
  try {
    await fs.access(dataFile);
  } catch {
    await fs.writeFile(dataFile, JSON.stringify(seedData, null, 2), "utf8");
  }
}

export async function readData(): Promise<AppData> {
  if (shouldUseMemoryStore()) {
    return structuredClone(getMemoryStore()) as AppData;
  }

  await ensureStore();
  const raw = await fs.readFile(dataFile, "utf8");
  return JSON.parse(raw) as AppData;
}

export async function writeData(data: AppData) {
  if (shouldUseMemoryStore()) {
    const storeHost = globalThis as GlobalStore;
    storeHost[memoryStoreKey] = structuredClone(data) as AppData;
    return;
  }

  await ensureStore();
  await fs.writeFile(dataFile, JSON.stringify(data, null, 2), "utf8");
}

export function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
