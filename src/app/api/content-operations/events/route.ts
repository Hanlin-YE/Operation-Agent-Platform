import { NextResponse } from "next/server";
import {
  RecordViewerEventInput,
  recordViewerEvent,
} from "@/server/content-operations/repository";
import { contentOperationsError, readRequestObject } from "../_shared";

export async function POST(request: Request) {
  try {
    const body = await readRequestObject(request);
    const event = await recordViewerEvent(body as unknown as RecordViewerEventInput);
    return NextResponse.json({ accepted: true, eventId: event.id }, { status: 202 });
  } catch (error) {
    return contentOperationsError(error);
  }
}
