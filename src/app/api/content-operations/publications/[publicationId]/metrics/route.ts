import { NextResponse } from "next/server";
import {
  AppendPlatformMetricSnapshotInput,
  appendPlatformMetricSnapshot,
  listPlatformMetricSnapshots,
} from "@/server/content-operations/repository";
import { contentOperationsError, readRequestObject } from "../../../_shared";

type RouteContext = { params: { publicationId: string } };

export async function GET(_: Request, { params }: RouteContext) {
  try {
    return NextResponse.json({ snapshots: await listPlatformMetricSnapshots(params.publicationId) });
  } catch (error) {
    return contentOperationsError(error);
  }
}

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const body = await readRequestObject(request);
    const snapshot = await appendPlatformMetricSnapshot(
      params.publicationId,
      { ...(body as unknown as AppendPlatformMetricSnapshotInput), source: "manual_entry" },
    );
    return NextResponse.json({ snapshot }, { status: 201 });
  } catch (error) {
    return contentOperationsError(error);
  }
}
