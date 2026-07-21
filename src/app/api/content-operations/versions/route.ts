import { NextResponse } from "next/server";
import {
  RegisterVideoVersionInput,
  listVideoVersions,
  registerVideoVersion,
} from "@/server/content-operations/repository";
import { contentOperationsError, readRequestObject } from "../_shared";

export async function GET(request: Request) {
  try {
    const seriesId = new URL(request.url).searchParams.get("seriesId") || undefined;
    return NextResponse.json({ versions: await listVideoVersions(seriesId) });
  } catch (error) {
    return contentOperationsError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await readRequestObject(request);
    const registered = await registerVideoVersion(body as unknown as RegisterVideoVersionInput);
    return NextResponse.json(registered, { status: 201 });
  } catch (error) {
    return contentOperationsError(error);
  }
}
