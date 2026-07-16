import { NextResponse } from "next/server";
import { buildAigcCreationPlan } from "@/server/aigc/creationPlanner";
import { AigcCreationRequest, AigcPlatform, AigcVideoType, PromptLanguage } from "@/server/aigc/types";

const platforms: AigcPlatform[] = ["runninghub"];
const videoTypes: AigcVideoType[] = ["product_ad", "product_showcase", "brand_intro", "xiaohongshu"];
const promptLanguages: PromptLanguage[] = ["zh", "en", "bilingual"];

function isValidPayload(body: Partial<AigcCreationRequest>): body is AigcCreationRequest {
  return Boolean(
    body.requirement?.trim() &&
      platforms.includes(body.platform as AigcPlatform) &&
      videoTypes.includes(body.videoType as AigcVideoType) &&
      promptLanguages.includes(body.promptLanguage as PromptLanguage) &&
      typeof body.durationSec === "number" &&
      body.durationSec >= 3 &&
      body.durationSec <= 180 &&
      (body.aspectRatio === "16:9" || body.aspectRatio === "9:16" || body.aspectRatio === "1:1") &&
      body.styleTone?.trim()
  );
}

export async function POST(request: Request) {
  const body = (await request.json()) as Partial<AigcCreationRequest>;
  if (!isValidPayload(body)) {
    return NextResponse.json({ error: "invalid aigc creation request" }, { status: 400 });
  }

  return NextResponse.json(buildAigcCreationPlan(body));
}
