import { NextResponse } from "next/server";
import { createLeads } from "@/server/repositories/leads";

const aliases: Record<string, string[]> = {
  companyName: ["公司名称", "companyName", "company"], industry: ["行业", "industry"], region: ["地区", "region"],
  companySize: ["公司规模", "companySize", "size"], contactName: ["联系人", "contactName"], contactTitle: ["职位", "contactTitle"],
  contactMethod: ["联系方式", "contactMethod"], source: ["来源", "source"], tags: ["标签", "tags"], notes: ["备注", "notes"]
};

function pick(row: Record<string, string>, key: string) {
  return aliases[key].map((alias) => row[alias]).find(Boolean) || "";
}

export async function POST(request: Request) {
  const body = await request.json();
  if (!Array.isArray(body.rows) || body.rows.length === 0 || body.rows.length > 500) return NextResponse.json({ message: "rows 必须包含 1-500 条记录" }, { status: 422 });
  const leads = await createLeads(body.rows.map((row: Record<string, string>) => ({
    companyName: pick(row, "companyName"), industry: pick(row, "industry"), region: pick(row, "region"), companySize: pick(row, "companySize"),
    contactName: pick(row, "contactName"), contactTitle: pick(row, "contactTitle"), contactMethod: pick(row, "contactMethod"), source: pick(row, "source") || "CSV 导入",
    tags: pick(row, "tags").split(/[,，、]/).map((item) => item.trim()).filter(Boolean), notes: pick(row, "notes")
  })));
  const tiers = { KA: 0, LA: 0, SMB: 0 };
  leads.forEach((lead) => { tiers[lead.accountTier] += 1; });
  return NextResponse.json({ created: leads.length, tiers }, { status: 201 });
}
