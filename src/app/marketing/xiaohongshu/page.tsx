import { XiaohongshuSignalsTable } from "@/components/marketing/XiaohongshuSignalsTable";
import { createXiaohongshuSource } from "@/server/sources/xiaohongshu";

export const dynamic = "force-dynamic";

export default async function MarketingXiaohongshuPage() {
  const signals = await createXiaohongshuSource().searchSignals({ focus: "all", limit: 50 });
  return <XiaohongshuSignalsTable signals={signals} />;
}
