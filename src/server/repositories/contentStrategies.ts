import { ContentStrategyPack } from "@/server/data/types";
import { makeId, readData, writeData } from "@/server/data/store";

export async function listContentStrategies() {
  const data = await readData();
  return [...(data.contentStrategies || [])].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
export async function getContentStrategy(id: string) {
  return (await readData()).contentStrategies?.find((item) => item.id === id) || null;
}
export async function getContentStrategyVersions(id: string) {
  const data = await readData(); const all = data.contentStrategies || []; const target = all.find((item) => item.id === id); if (!target) return [];
  let root = target; while (root.parentId) { const parent = all.find((item) => item.id === root.parentId); if (!parent) break; root = parent; }
  const ids = new Set([root.id]); let changed = true;
  while (changed) { changed = false; for (const item of all) if (item.parentId && ids.has(item.parentId) && !ids.has(item.id)) { ids.add(item.id); changed = true; } }
  return all.filter((item) => ids.has(item.id)).sort((a, b) => a.version - b.version);
}
export async function isLatestContentStrategy(id: string) { const versions = await getContentStrategyVersions(id); return versions.length > 0 && versions.at(-1)?.id === id; }
export async function createContentStrategy(input: Omit<ContentStrategyPack, "id" | "createdAt" | "updatedAt">) {
  const data = await readData(); const now = new Date().toISOString();
  const record: ContentStrategyPack = { ...input, id: makeId("strategy"), createdAt: now, updatedAt: now };
  data.contentStrategies = [record, ...(data.contentStrategies || [])]; await writeData(data); return record;
}
export async function updateContentStrategy(id: string, patch: Partial<ContentStrategyPack>) {
  const data = await readData(); const index = data.contentStrategies?.findIndex((item) => item.id === id) ?? -1;
  if (index < 0 || !data.contentStrategies) return null;
  const updated = { ...data.contentStrategies[index], ...patch, id, updatedAt: new Date().toISOString() };
  data.contentStrategies[index] = updated; await writeData(data); return updated;
}
