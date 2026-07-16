import { NextResponse } from "next/server";
import { listAigcJobs } from "@/server/aigc/jobStore";
import { hasDispatchAccess } from "@/server/aigc/operator";
import { refreshRunningHubJob } from "@/server/aigc/runningHubAdapter";

const refreshableStatuses = new Set(["mock_queued", "mock_running", "submitted", "running"]);

export async function POST(request: Request) {
  if (!hasDispatchAccess(request)) {
    return NextResponse.json({ error: "dispatch access denied" }, { status: 401 });
  }

  const jobs = await listAigcJobs();
  const candidates = jobs.filter((job) => refreshableStatuses.has(job.status)).slice(0, 20);
  const refreshed = await Promise.all(candidates.map((job) => refreshRunningHubJob(job.jobId)));
  return NextResponse.json({ refreshed: refreshed.filter(Boolean).length });
}
