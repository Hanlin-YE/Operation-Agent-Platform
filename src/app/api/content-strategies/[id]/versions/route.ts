import { NextResponse } from "next/server";
import { getContentStrategyVersions } from "@/server/repositories/contentStrategies";
export async function GET(_: Request, { params }: { params: { id: string } }) { return NextResponse.json(await getContentStrategyVersions(params.id)); }
