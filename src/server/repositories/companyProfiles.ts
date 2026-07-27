import { CompanyProfile } from "@/server/data/types";
import { readData, writeData } from "@/server/data/store";

export async function listCompanyProfiles() {
  const data = await readData();
  return [...(data.companyProfiles || [])].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function saveCompanyProfiles(profiles: CompanyProfile[]) {
  const data = await readData();
  const existing = new Map((data.companyProfiles || []).map((profile) => [profile.id, profile]));
  for (const profile of profiles) {
    existing.set(profile.id, {
      ...existing.get(profile.id),
      ...profile,
      updatedAt: new Date().toISOString()
    });
  }
  data.companyProfiles = Array.from(existing.values());
  await writeData(data);
  return profiles;
}

export async function getCompanyProfilesByIds(ids: string[]) {
  const idSet = new Set(ids);
  return (await listCompanyProfiles()).filter((profile) => idSet.has(profile.id));
}
