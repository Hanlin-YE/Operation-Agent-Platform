import { LeadForm } from "@/components/leads/LeadForm";
import { LeadTable } from "@/components/leads/LeadTable";
import { CsvLeadImport } from "@/components/leads/CsvLeadImport";
import { listLeads } from "@/server/repositories/leads";

export const dynamic = "force-dynamic";

export default async function LeadsPage() {
  const leads = await listLeads();

  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">Lead Workspace</p>
          <h1>线索管理</h1>
          <p className="subtle">把客户名单、行业信息、联系人和需求备注沉淀成可评分、可生成话术的销售资产。</p>
        </div>
      </div>
      <CsvLeadImport />
      <div className="split">
        <LeadTable leads={leads} />
        <LeadForm />
      </div>
    </>
  );
}
