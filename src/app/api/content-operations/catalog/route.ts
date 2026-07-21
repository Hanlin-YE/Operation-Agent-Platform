import { NextResponse } from "next/server";
import { getContentOperationsCatalogResponse } from "@/server/content-operations/repository";
import { contentOperationsError } from "../_shared";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await getContentOperationsCatalogResponse());
  } catch (error) {
    return contentOperationsError(error);
  }
}
