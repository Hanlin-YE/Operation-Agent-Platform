import { NextResponse } from "next/server";
import {
  CreateContentSeriesInput,
  createContentSeries,
  listContentSeries,
} from "@/server/content-operations/repository";
import { contentOperationsError, readRequestObject } from "../_shared";

export async function GET() {
  try {
    return NextResponse.json({ series: await listContentSeries() });
  } catch (error) {
    return contentOperationsError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await readRequestObject(request);
    const created = await createContentSeries(body as unknown as CreateContentSeriesInput);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return contentOperationsError(error);
  }
}
