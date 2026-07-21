import { NextResponse } from "next/server";
import { updatePublicationLedger } from "@/server/content-operations/repository";
import { contentOperationsError, readRequestObject } from "@/app/api/content-operations/_shared";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ versionId: string }> }
) {
  try {
    const { versionId } = await params;
    const body = await readRequestObject(request);
    const patch: Record<string, unknown> = {};
    if (body.title !== undefined) patch.title = body.title;
    if (body.batch !== undefined) patch.batch = body.batch;
    if (body.registeredBy !== undefined) patch.registeredBy = body.registeredBy;
    if (body.publishedBy !== undefined) patch.publishedBy = body.publishedBy;
    if (body.approvedBy !== undefined) patch.approvedBy = body.approvedBy;
    if (body.status !== undefined) patch.status = body.status;
    if (body.publishedAt !== undefined) patch.publishedAt = body.publishedAt;
    const updated = await updatePublicationLedger(versionId, patch as Parameters<typeof updatePublicationLedger>[1]);
    return NextResponse.json({ version: updated });
  } catch (error) {
    return contentOperationsError(error);
  }
}
