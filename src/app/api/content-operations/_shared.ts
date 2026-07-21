import { NextResponse } from "next/server";
import { ContentOperationsRepositoryError } from "@/server/content-operations/repository";

export async function readRequestObject(request: Request) {
  try {
    const value = await request.json();
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error("request body must be a JSON object");
    }
    return value as Record<string, unknown>;
  } catch (error) {
    if (error instanceof Error && error.message === "request body must be a JSON object") throw error;
    throw new Error("request body must be valid JSON");
  }
}

export function contentOperationsError(error: unknown) {
  if (error instanceof ContentOperationsRepositoryError) {
    const status = error.kind === "not_found" ? 404 : error.kind === "conflict" ? 409 : error.kind === "configuration" ? 503 : 422;
    return NextResponse.json({ error: error.code, message: error.message }, { status });
  }
  const message = error instanceof Error ? error.message : "content operations request failed";
  const status = message.startsWith("request body must") ? 400 : 500;
  return NextResponse.json({ error: status === 400 ? "invalid_json" : "internal_error", message }, { status });
}
