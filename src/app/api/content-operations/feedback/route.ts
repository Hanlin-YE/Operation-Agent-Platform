import { NextResponse } from "next/server";
import {
  SubmitViewerFeedbackInput,
  upsertViewerFeedback,
} from "@/server/content-operations/repository";
import { contentOperationsError, readRequestObject } from "../_shared";

export async function POST(request: Request) {
  try {
    const body = await readRequestObject(request);
    const feedback = await upsertViewerFeedback(body as unknown as SubmitViewerFeedbackInput);
    return NextResponse.json({ accepted: true, feedbackId: feedback.id }, { status: 201 });
  } catch (error) {
    return contentOperationsError(error);
  }
}
