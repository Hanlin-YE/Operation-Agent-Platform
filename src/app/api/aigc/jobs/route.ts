import { NextResponse } from "next/server";
import { listAigcJobs } from "@/server/aigc/jobStore";
import { submitRunningHubJob } from "@/server/aigc/runningHubAdapter";
import { AigcJobSubmitRequest } from "@/server/aigc/types";
import { actorFromRequest, hasDispatchAccess } from "@/server/aigc/operator";

function isSubmitPayload(body: Partial<AigcJobSubmitRequest>): body is AigcJobSubmitRequest {
  return Boolean(
    body.request &&
      body.plan &&
      Array.isArray(body.assetApprovals) &&
      body.assetApprovals.length === body.plan.assets.length &&
      body.plan.assets.every((asset) => body.assetApprovals?.some((approval) => approval.assetId === asset.assetId)) &&
      body.assetApprovals.every((approval) => ["pending", "approved", "rejected"].includes(approval.status)) &&
      (body.submitMode === "mock" || body.submitMode === "live") &&
      body.request.platform === "runninghub"
  );
}

export async function GET() {
  return NextResponse.json(await listAigcJobs());
}

export async function POST(request: Request) {
  const body = (await request.json()) as Partial<AigcJobSubmitRequest>;
  if (!isSubmitPayload(body)) {
    return NextResponse.json({ error: "invalid aigc job submit request" }, { status: 400 });
  }

  if (body.submitMode === "live" && !hasDispatchAccess(request)) {
    return NextResponse.json({ error: "live submission access denied" }, { status: 401 });
  }

  return NextResponse.json(await submitRunningHubJob({ ...body, actor: actorFromRequest(request) }));
}
