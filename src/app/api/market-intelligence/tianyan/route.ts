import { createTianyanMarketPostHandler } from "@/server/sources/tianyanMarketRoute";

export const runtime = "nodejs";

export const POST = createTianyanMarketPostHandler();
