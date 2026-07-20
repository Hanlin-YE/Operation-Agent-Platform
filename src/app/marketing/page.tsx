import { MarketAnalysisWorkbench } from "@/components/marketing/MarketAnalysisWorkbench";
import { listMarketReports } from "@/server/repositories/marketReports";

export const dynamic = "force-dynamic";

export default async function MarketingPage() {
  const reports = await listMarketReports();
  return <MarketAnalysisWorkbench initialReports={reports} view="overview" />;
}
