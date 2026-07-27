import { NextResponse } from "next/server";
import { compareCompanyProfiles } from "@/server/analysis/companyComparison";
import type { CompanyProfile } from "@/server/data/types";
import { getCompanyProfilesByIds } from "@/server/repositories/companyProfiles";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { profileIds?: unknown; profiles?: unknown } | null;
  if (!body) return NextResponse.json({ error: "invalid_body" }, { status: 400 });

  let profiles: CompanyProfile[] = [];
  if (Array.isArray(body.profileIds)) {
    profiles = await getCompanyProfilesByIds(body.profileIds.filter((id): id is string => typeof id === "string"));
  } else if (Array.isArray(body.profiles)) {
    profiles = body.profiles.filter((item): item is CompanyProfile => Boolean(item && typeof item === "object" && !Array.isArray(item)));
  }

  if (profiles.length < 2 || profiles.length > 5) return NextResponse.json({ error: "profile_count_must_be_2_to_5" }, { status: 400 });
  return NextResponse.json({ result: compareCompanyProfiles(profiles) });
}
