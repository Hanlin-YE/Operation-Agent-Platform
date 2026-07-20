"use client";

import { FormEvent, useState } from "react";
import { Search } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

export function LeadFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("query") || "");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const params = new URLSearchParams();
    for (const [key, value] of formData.entries()) {
      if (typeof value === "string") params.set(key, value);
    }
    if (!query.trim()) params.delete("query");
    if (!params.get("status")) params.delete("status");
    if (!params.get("accountTier")) params.delete("accountTier");
    router.push(`/leads${params.size ? `?${params}` : ""}`);
  }

  return (
    <form className="panel" style={{ marginBottom: 16 }} onSubmit={submit}>
      <div className="actions">
        <input name="query" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索公司、联系人、行业或标签" aria-label="搜索线索" />
        <select name="status" defaultValue={searchParams.get("status") || ""} aria-label="按状态筛选">
          <option value="">全部状态</option><option value="new">新线索</option><option value="to_follow">待跟进</option><option value="contacted">已联系</option><option value="interested">有意向</option><option value="deferred">暂缓</option><option value="invalid">无效</option>
        </select>
        <select name="accountTier" defaultValue={searchParams.get("accountTier") || ""} aria-label="按账户分层筛选">
          <option value="">全部分层</option><option value="KA">KA</option><option value="LA">LA</option><option value="SMB">SMB</option>
        </select>
        <button className="button secondary"><Search size={16} />筛选</button>
      </div>
    </form>
  );
}
