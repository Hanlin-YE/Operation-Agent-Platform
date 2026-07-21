import { NextResponse } from "next/server";
import { listAigcJobs } from "@/server/aigc/jobStore";
import { buildAigcReview } from "@/server/aigc/reviewEvaluator";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get("jobId");
  const jobs = await listAigcJobs();
  const selected = jobId ? jobs.filter((job) => job.jobId === jobId) : jobs;

  if (jobId && !selected.length) {
    return NextResponse.json({ error: "review job not found" }, { status: 404 });
  }

  const reviews = selected
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .map((job) => buildAigcReview(job));

  if (jobId) {
    return NextResponse.json({ review: reviews[0] });
  }

  return NextResponse.json({ reviews });
}
