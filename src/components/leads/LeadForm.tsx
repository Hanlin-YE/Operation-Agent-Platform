"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Lead } from "@/server/data/types";
import { Plus } from "lucide-react";

export function LeadForm({ lead, onCancel }: { lead?: Lead; onCancel?: () => void }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    const form = event.currentTarget;
    const formData = new FormData(form);
    const payload = Object.fromEntries(formData.entries());

    setError("");
    try {
      const response = await fetch(lead ? `/api/leads/${lead.id}` : "/api/leads", {
        method: lead ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "保存失败，请重试。");
      if (!lead) form.reset();
      router.refresh();
      onCancel?.();
    } catch (error) {
      setError(error instanceof Error ? error.message : "连接失败，请重试。");
    } finally { setLoading(false); }
  }

  return (
    <form className="panel" onSubmit={onSubmit}>
      <h2>{lead ? "编辑线索" : "新建线索"}</h2>
      <div className="form-grid">
        <div className="field">
          <label htmlFor={`${lead?.id || "new"}-companyName`}>公司名称</label>
          <input id={`${lead?.id || "new"}-companyName`} name="companyName" defaultValue={lead?.companyName} required placeholder="例如：某某智能装备有限公司" />
        </div>
        <div className="field">
          <label htmlFor={`${lead?.id || "new"}-industry`}>行业</label>
          <input id={`${lead?.id || "new"}-industry`} name="industry" defaultValue={lead?.industry} placeholder="自动化设备 / 泵阀 / 风机 / 包装机械" />
        </div>
        <div className="field">
          <label htmlFor={`${lead?.id || "new"}-region`}>地区</label>
          <input id={`${lead?.id || "new"}-region`} name="region" defaultValue={lead?.region} placeholder="江苏苏州" />
        </div>
        <div className="field">
          <label htmlFor={`${lead?.id || "new"}-companySize`}>公司规模</label>
          <input id={`${lead?.id || "new"}-companySize`} name="companySize" defaultValue={lead?.companySize} placeholder="200-500人" />
        </div>
        <div className="field">
          <label htmlFor={`${lead?.id || "new"}-contactName`}>联系人</label>
          <input id={`${lead?.id || "new"}-contactName`} name="contactName" defaultValue={lead?.contactName} placeholder="张经理" />
        </div>
        <div className="field">
          <label htmlFor={`${lead?.id || "new"}-contactTitle`}>职位</label>
          <input id={`${lead?.id || "new"}-contactTitle`} name="contactTitle" defaultValue={lead?.contactTitle} placeholder="采购经理 / 技术工程师" />
        </div>
        <div className="field">
          <label htmlFor={`${lead?.id || "new"}-contactMethod`}>联系方式</label>
          <input id={`${lead?.id || "new"}-contactMethod`} name="contactMethod" defaultValue={lead?.contactMethod} placeholder="手机号 / 邮箱 / 微信" />
        </div>
        <div className="field">
          <label htmlFor={`${lead?.id || "new"}-source`}>来源</label>
          <input id={`${lead?.id || "new"}-source`} name="source" defaultValue={lead?.source} placeholder="展会 / 官网询盘 / 手工录入" />
        </div>
        <div className="field full">
          <label htmlFor={`${lead?.id || "new"}-tags`}>标签</label>
          <input id={`${lead?.id || "new"}-tags`} name="tags" defaultValue={lead?.tags.join(", ")} placeholder="设备厂, 输送线, 高潜" />
        </div>
        <div className="field full">
          <label htmlFor={`${lead?.id || "new"}-notes`}>备注</label>
          <textarea id={`${lead?.id || "new"}-notes`} name="notes" defaultValue={lead?.notes} placeholder="客户设备类型、近期需求、价格敏感度、技术关注点..." />
        </div>
      </div>
      {error ? <p role="alert">{error}</p> : null}
      <div className="actions" style={{ marginTop: 14 }}>
        <button className="button" disabled={loading}>
          <Plus size={17} />
          {loading ? "保存中" : "保存线索"}
        </button>
        {onCancel ? <button type="button" className="button secondary" onClick={onCancel} disabled={loading}>取消</button> : null}
      </div>
    </form>
  );
}
