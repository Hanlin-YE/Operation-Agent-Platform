import { NextResponse } from "next/server";
import { getAigcJob } from "@/server/aigc/jobStore";
import { refreshRunningHubJob } from "@/server/aigc/runningHubAdapter";

export async function GET(_: Request, { params }: { params: { jobId: string } }) {
  const job = await refreshRunningHubJob(params.jobId);
  if (!job) {
    return NextResponse.json({ error: "job not found" }, { status: 404 });
  }
  return NextResponse.json(job);
}

export async function POST(_: Request, { params }: { params: { jobId: string } }) {
  const job = await getAigcJob(params.jobId);
  if (!job) {
    return NextResponse.json({ error: "job not found" }, { status: 404 });
  }

  return NextResponse.json(await refreshRunningHubJob(params.jobId));
}
