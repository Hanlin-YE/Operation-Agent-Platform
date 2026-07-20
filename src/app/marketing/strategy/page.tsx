import { MarketAnalysisWorkbench } from "@/components/marketing/MarketAnalysisWorkbench";
import { listMarketReports } from "@/server/repositories/marketReports";

export const dynamic = "force-dynamic";

export default async function MarketingStrategyPage() {
  return <MarketAnalysisWorkbench initialReports={await listMarketReports()} view="strategy" />;
}
