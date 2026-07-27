import { NextResponse } from "next/server";
import { buildCompanyProfileFromTianyan, buildCompanyProfilesFromRecords } from "@/server/analysis/companyProfile";
import { listCompanyProfiles, saveCompanyProfiles } from "@/server/repositories/companyProfiles";

export async function GET() {
  return NextResponse.json({ profiles: await listCompanyProfiles() });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { source?: string; profile?: unknown; records?: unknown } | null;
  if (!body) return NextResponse.json({ error: "invalid_body" }, { status: 400 });

  let profiles = [];
  if (body.source === "tianyan" && body.profile && typeof body.profile === "object") {
    profiles = [buildCompanyProfileFromTianyan(body.profile as Parameters<typeof buildCompanyProfileFromTianyan>[0])];
  } else if (Array.isArray(body.records)) {
    profiles = buildCompanyProfilesFromRecords(body.records.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object" && !Array.isArray(item))));
  } else {
    return NextResponse.json({ error: "unsupported_payload" }, { status: 400 });
  }

  if (!profiles.length) return NextResponse.json({ error: "empty_profiles" }, { status: 400 });
  await saveCompanyProfiles(profiles);
  return NextResponse.json({ profiles });
}
