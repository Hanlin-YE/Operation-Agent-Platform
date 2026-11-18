import { FollowUp, Lead } from "@/server/data/types";

export const salesTimeZone = "Asia/Shanghai";
export function salesDate(value: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: salesTimeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(value);
}

// Older datetime-local values were saved without an offset. Interpret them in the sales team's timezone.
export function followUpDate(value: string) {
  return new Date(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/.test(value) ? `${value}+08:00` : value);
}

export function getDailyWork(leads: Lead[], followUps: FollowUp[], now = new Date()) {
  const today = salesDate(now);
  const byId = new Map(leads.map((lead) => [lead.id, lead]));
  const open = followUps.filter((item) => item.status === "open" && byId.has(item.leadId) && byId.get(item.leadId)?.status !== "invalid");
  const tasks = open.map((task) => ({ task, lead: byId.get(task.leadId)! }));
  const dated = tasks.filter(({ task }) => task.nextActionAt && Number.isFinite(followUpDate(task.nextActionAt).getTime()))
    .sort((a, b) => followUpDate(a.task.nextActionAt!).getTime() - followUpDate(b.task.nextActionAt!).getTime());
  return {
    overdue: dated.filter(({ task }) => salesDate(followUpDate(task.nextActionAt!)) < today),
    today: dated.filter(({ task }) => salesDate(followUpDate(task.nextActionAt!)) === today),
    unscheduled: tasks.filter(({ task }) => !task.nextActionAt || !Number.isFinite(followUpDate(task.nextActionAt).getTime())),
    unplannedLeads: leads.filter((lead) => ["new", "to_follow", "interested"].includes(lead.status) && !open.some((task) => task.leadId === lead.id))
  };
}
