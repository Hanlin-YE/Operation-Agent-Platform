import { NextResponse } from "next/server";
import {
  ChannelPublicationDraft,
  createChannelPublication,
  listChannelPublications,
} from "@/server/content-operations/repository";
import { ContentChannel } from "@/server/content-operations/types";
import { contentOperationsError, readRequestObject } from "../_shared";

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const videoVersionId = params.get("videoVersionId") || undefined;
    const channel = params.get("channel") as ContentChannel | null;
    return NextResponse.json({
      publications: await listChannelPublications(videoVersionId, channel || undefined),
    });
  } catch (error) {
    return contentOperationsError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await readRequestObject(request);
    const videoVersionId = body.videoVersionId as string;
    const publication = await createChannelPublication(
      videoVersionId,
      body as unknown as ChannelPublicationDraft,
    );
    return NextResponse.json({ publication }, { status: 201 });
  } catch (error) {
    return contentOperationsError(error);
  }
}
