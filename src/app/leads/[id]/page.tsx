import { notFound } from "next/navigation";
import { PitchGenerator } from "@/components/agent/PitchGenerator";
import { LeadTimeline } from "@/components/leads/LeadTimeline";
import { ScoreBreakdown } from "@/components/scoring/ScoreBreakdown";
import { ProductRecommendationCard } from "@/components/agent/ProductRecommendationCard";
import { CustomerServiceSimulator } from "@/components/agent/CustomerServiceSimulator";
import { getLead } from "@/server/repositories/leads";
import { listFollowUpsByLead, listPitchesByLead, listScoresByLead } from "@/server/repositories/salesArtifacts";

export const dynamic = "force-dynamic";

export default async function LeadDetailPage({ params }: { params: { id: string } }) {
  const lead = await getLead(params.id);
  if (!lead) notFound();

  const [scores, pitches, followUps] = await Promise.all([
    listScoresByLead(lead.id),
    listPitchesByLead(lead.id),
    listFollowUpsByLead(lead.id)
  ]);

  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">Lead Detail</p>
          <h1>{lead.companyName}</h1>
          <p className="subtle">
            {lead.industry} · {lead.region} · {lead.companySize}
          </p>
        </div>
        <a className="button secondary" href="/leads">返回线索列表</a>
      </div>

      <div className="grid cols-2">
        <div className="panel">
          <h2>客户画像</h2>
          <p><strong>联系人：</strong>{lead.contactName} / {lead.contactTitle}</p>
          <p><strong>联系方式：</strong>{lead.contactMethod}</p>
          <p><strong>来源：</strong>{lead.source}</p>
          <div className="badge-row">
            {lead.tags.map((tag) => (
              <span className="badge" key={tag}>{tag}</span>
            ))}
          </div>
          <p className="subtle" style={{ marginTop: 12 }}>{lead.notes}</p>
        </div>
        <ScoreBreakdown leadId={lead.id} initialScore={scores[0]} />
      </div>

      <div className="grid cols-2" style={{ marginTop: 16 }}>
        <ProductRecommendationCard leadId={lead.id} />
        <PitchGenerator leadId={lead.id} initialPitch={pitches[0]} />
        <LeadTimeline scores={scores} pitches={pitches} followUps={followUps} />
      </div>
      <div style={{ marginTop: 16 }}><CustomerServiceSimulator leadId={lead.id} tier={lead.accountTier} /></div>
    </>
  );
}
