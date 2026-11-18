import { Lead } from "@/server/data/types";

export const leadTextFields = ["companyName", "industry", "region", "companySize", "contactName", "contactTitle", "contactMethod", "source", "notes"] as const;
export const leadStatuses: Lead["status"][] = ["new", "to_follow", "contacted", "interested", "invalid", "deferred"];
export type EditableLead = Pick<Lead, typeof leadTextFields[number] | "tags" | "status">;

export function parseLeadPatch(body: Record<string, unknown>): Partial<EditableLead> {
  const result: Partial<EditableLead> = {};
  for (const field of leadTextFields) {
    if (!(field in body)) continue;
    if (typeof body[field] !== "string") throw new Error(`${field} 必须是文本。`);
    result[field] = body[field].trim();
  }
  if ("companyName" in result && !result.companyName) throw new Error("请填写公司名称。");
  if ("status" in body) {
    if (!leadStatuses.includes(body.status as Lead["status"])) throw new Error("线索状态无效。");
    result.status = body.status as Lead["status"];
  }
  if ("tags" in body) {
    const tags = typeof body.tags === "string" ? body.tags.split(/[,，、]/) : body.tags;
    if (!Array.isArray(tags) || tags.some((tag) => typeof tag !== "string")) throw new Error("标签格式无效。");
    result.tags = [...new Set(tags.map((tag: string) => tag.trim()).filter(Boolean))];
  }
  if (!Object.keys(result).length) throw new Error("没有要修改的线索字段。");
  return result;
}
