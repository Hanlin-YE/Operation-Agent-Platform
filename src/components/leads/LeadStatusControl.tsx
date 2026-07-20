"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lead, LeadStatus } from "@/server/data/types";

const options: { value: LeadStatus; label: string }[] = [
  { value: "new", label: "新线索" }, { value: "to_follow", label: "待跟进" }, { value: "contacted", label: "已联系" },
  { value: "interested", label: "有意向" }, { value: "deferred", label: "暂缓" }, { value: "invalid", label: "无效" }
];

export function LeadStatusControl({ lead }: { lead: Lead }) {
  const router = useRouter();
  const [status, setStatus] = useState(lead.status);
  const [saving, setSaving] = useState(false);

  async function save(next: LeadStatus) {
    setStatus(next); setSaving(true);
    const response = await fetch("/api/leads", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: lead.id, status: next }) });
    setSaving(false);
    if (response.ok) router.refresh();
  }

  return <label className="field" style={{ maxWidth: 220 }}><span>线索状态</span><select value={status} disabled={saving} onChange={(event) => save(event.target.value as LeadStatus)}>{options.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>;
}
