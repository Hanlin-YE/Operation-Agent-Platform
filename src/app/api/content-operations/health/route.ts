import { NextResponse } from "next/server";
import { getContentOperationsStorageInfo } from "@/server/content-operations/store";

export async function GET() {
  const sessionSaltConfigured = Boolean(process.env.CONTENT_OPERATIONS_SESSION_SALT?.trim());
  const productionMisconfigured = process.env.NODE_ENV === "production" && !sessionSaltConfigured;
  return NextResponse.json({
    status: productionMisconfigured ? "degraded" : "ready",
    storage: getContentOperationsStorageInfo(),
    sessionHashing: sessionSaltConfigured ? "configured" : productionMisconfigured ? "configuration_required" : "demo_salt",
  }, { status: productionMisconfigured ? 503 : 200 });
}
