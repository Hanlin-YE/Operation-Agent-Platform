import { MarketAnalysisReport } from "@/server/data/types";
import { makeId, readData, writeData } from "@/server/data/store";

export async function listMarketReports() {
  const data = await readData();
  return [...(data.marketReports || [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function saveMarketReport(input: Omit<MarketAnalysisReport, "id" | "createdAt">) {
  const data = await readData();
  const report: MarketAnalysisReport = {
    ...input,
    id: makeId("market-report"),
    createdAt: new Date().toISOString()
  };
  data.marketReports = [report, ...(data.marketReports || [])];
  await writeData(data);
  return report;
}
