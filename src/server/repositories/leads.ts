import { Lead, LeadStatus } from "@/server/data/types";
import { makeId, readData, writeData } from "@/server/data/store";
import { deriveAccountRouting } from "@/server/segmentation/accountTier";

export type LeadInput = Omit<Lead, "id" | "createdAt" | "updatedAt">;

export async function listLeads() {
  const data = await readData();
  return data.leads.map((lead) => ({ ...lead, ...deriveAccountRouting(lead) })).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getLead(id: string) {
  const data = await readData();
  const lead = data.leads.find((item) => item.id === id);
  return lead ? { ...lead, ...deriveAccountRouting(lead) } : null;
}

export async function createLead(input: Partial<LeadInput>) {
  const data = await readData();
  const now = new Date().toISOString();
  const baseLead = {
    id: makeId("lead"),
    companyName: input.companyName?.trim() || "未命名公司",
    industry: input.industry?.trim() || "未知行业",
    region: input.region?.trim() || "未知地区",
    companySize: input.companySize?.trim() || "未知规模",
    contactName: input.contactName?.trim() || "待补充",
    contactTitle: input.contactTitle?.trim() || "待补充",
    contactMethod: input.contactMethod?.trim() || "待补充",
    source: input.source?.trim() || "手工录入",
    status: input.status || "new",
    tags: input.tags || [],
    notes: input.notes?.trim() || "",
    createdAt: now,
    updatedAt: now
  };
  const lead: Lead = { ...baseLead, ...deriveAccountRouting(baseLead) };
  data.leads.unshift(lead);
  await writeData(data);
  return lead;
}

export async function createLeads(inputs: Array<Partial<LeadInput>>) {
  const data = await readData();
  const now = new Date().toISOString();
  const leads = inputs.map((input) => {
    const baseLead = {
      id: makeId("lead"), companyName: input.companyName?.trim() || "未命名公司", industry: input.industry?.trim() || "未知行业",
      region: input.region?.trim() || "未知地区", companySize: input.companySize?.trim() || "未知规模", contactName: input.contactName?.trim() || "待补充",
      contactTitle: input.contactTitle?.trim() || "待补充", contactMethod: input.contactMethod?.trim() || "待补充", source: input.source?.trim() || "CSV 导入",
      status: input.status || "new" as const, tags: input.tags || [], notes: input.notes?.trim() || "", createdAt: now, updatedAt: now
    };
    return { ...baseLead, ...deriveAccountRouting(baseLead) };
  });
  data.leads.unshift(...leads);
  await writeData(data);
  return leads;
}

export async function updateLeadStatus(id: string, status: LeadStatus) {
  const data = await readData();
  const lead = data.leads.find((item) => item.id === id);
  if (!lead) return null;
  lead.status = status;
  lead.updatedAt = new Date().toISOString();
  await writeData(data);
  return lead;
}
