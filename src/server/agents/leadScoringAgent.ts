import { getLead } from "@/server/repositories/leads";
import { saveScore } from "@/server/repositories/salesArtifacts";
import { buildScoreExplanation } from "@/server/scoring/scoreLead";

export async function runLeadScoringAgent(leadId: string) {
  const lead = await getLead(leadId);
  if (!lead) {
    throw new Error("Lead not found");
  }

  const score = buildScoreExplanation(lead);
  return saveScore({
    leadId,
    ...score
  });
}
