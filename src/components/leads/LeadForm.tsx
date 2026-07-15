"use client";

import { FormEvent, useState } from "react";
import { Plus } from "lucide-react";

export function LeadForm() {
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    const form = event.currentTarget;
    const formData = new FormData(form);
    const payload = Object.fromEntries(formData.entries());

    await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    form.reset();
    window.location.reload();
  }

  return (
    <form className="panel" onSubmit={onSubmit}>
      <h2>新建线索</h2>
      <div className="form-grid">
        <div className="field">
          <label>公司名称</label>
          <input name="companyName" required placeholder="例如：某某智能装备有限公司" />
        </div>
        <div className="field">
          <label>行业</label>
          <input name="industry" placeholder="自动化设备 / 泵阀 / 风机 / 包装机械" />
        </div>
        <div className="field">
          <label>地区</label>
          <input name="region" placeholder="江苏苏州" />
        </div>
        <div className="field">
          <label>公司规模</label>
          <input name="companySize" placeholder="200-500人" />
        </div>
        <div className="field">
          <label>联系人</label>
          <input name="contactName" placeholder="张经理" />
        </div>
        <div className="field">
          <label>职位</label>
          <input name="contactTitle" placeholder="采购经理 / 技术工程师" />
        </div>
        <div className="field">
          <label>联系方式</label>
          <input name="contactMethod" placeholder="手机号 / 邮箱 / 微信" />
        </div>
        <div className="field">
          <label>来源</label>
          <input name="source" placeholder="展会 / 官网询盘 / 手工录入" />
        </div>
        <div className="field full">
          <label>标签</label>
          <input name="tags" placeholder="设备厂, 输送线, 高潜" />
        </div>
        <div className="field full">
          <label>备注</label>
          <textarea name="notes" placeholder="客户设备类型、近期需求、价格敏感度、技术关注点..." />
        </div>
      </div>
      <div className="actions" style={{ marginTop: 14 }}>
        <button className="button" disabled={loading}>
          <Plus size={17} />
          {loading ? "保存中" : "保存线索"}
        </button>
      </div>
    </form>
  );
}
