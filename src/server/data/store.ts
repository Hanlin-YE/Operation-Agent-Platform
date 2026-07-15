import { promises as fs } from "fs";
import path from "path";
import { AppData } from "./types";
import { seedData } from "./seed";

const dataFile = path.join(process.cwd(), "data", "app-data.json");

async function ensureStore() {
  await fs.mkdir(path.dirname(dataFile), { recursive: true });
  try {
    await fs.access(dataFile);
  } catch {
    await fs.writeFile(dataFile, JSON.stringify(seedData, null, 2), "utf8");
  }
}

export async function readData(): Promise<AppData> {
  await ensureStore();
  const raw = await fs.readFile(dataFile, "utf8");
  return JSON.parse(raw) as AppData;
}

export async function writeData(data: AppData) {
  await ensureStore();
  await fs.writeFile(dataFile, JSON.stringify(data, null, 2), "utf8");
}

export function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
