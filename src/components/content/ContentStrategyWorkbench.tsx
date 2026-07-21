"use client";

import { VideoAnalysisWorkbench } from "@/components/content/VideoAnalysisWorkbench";

export function ContentStrategyWorkbench({ initialVideoJobId }: { initialVideoJobId?: string }) {
  return <VideoAnalysisWorkbench initialJobId={initialVideoJobId} />;
}
