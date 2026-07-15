import { Lead } from "@/server/data/types";

const statusLabels: Record<Lead["status"], string> = {
  new: "新线索",
  to_follow: "待跟进",
  contacted: "已联系",
  interested: "有意向",
  invalid: "无效",
  deferred: "暂缓"
};

export function LeadTable({ leads }: { leads: Lead[] }) {
  return (
    <div className="panel">
      <h2>线索列表</h2>
      <table className="table">
        <thead>
          <tr>
            <th>公司</th>
            <th>行业/地区</th>
            <th>联系人</th>
            <th>分层 / 路由</th>
            <th>标签</th>
            <th>状态</th>
          </tr>
        </thead>
        <tbody>
          {leads.map((lead) => (
            <tr key={lead.id}>
              <td>
                <a href={`/leads/${lead.id}`}>
                  <strong>{lead.companyName}</strong>
                </a>
                <p className="subtle">{lead.source}</p>
              </td>
              <td>
                {lead.industry}
                <p className="subtle">{lead.region}</p>
              </td>
              <td>
                {lead.contactName}
                <p className="subtle">{lead.contactTitle}</p>
              </td>
              <td>
                <span className={`badge grade-${lead.accountTier === "KA" ? "A" : lead.accountTier === "LA" ? "B" : "C"}`}>{lead.accountTier}</span>
                <p className="subtle">{lead.routingPolicy === "HUMAN_REQUIRED" ? "KA 人工沟通" : lead.routingPolicy === "HUMAN_APPROVAL" ? "需人工审批" : "受控培育"}</p>
              </td>
              <td>
                <div className="badge-row">
                  {lead.tags.map((tag) => (
                    <span className="badge" key={tag}>
                      {tag}
                    </span>
                  ))}
                </div>
              </td>
              <td>
                <span className="badge">{statusLabels[lead.status]}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
