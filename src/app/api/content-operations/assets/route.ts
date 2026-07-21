import { NextResponse } from "next/server";
import {
  AssetReferenceDraft,
  bulkAddAssetReferences,
} from "@/server/content-operations/repository";
import { contentOperationsError, readRequestObject } from "../_shared";

const assetTypeValues = new Set(["script", "storyboard", "prompt", "video"]);

function isAssetDraft(value: unknown): value is AssetReferenceDraft {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const draft = value as Record<string, unknown>;
  return (
    typeof draft.assetType === "string"
    && assetTypeValues.has(draft.assetType)
    && typeof draft.assetVersion === "string"
    && typeof draft.referenceUrl === "string"
    && typeof draft.summary === "string"
  );
}

export async function POST(request: Request) {
  try {
    const body = await readRequestObject(request);
    const videoVersionId = body.videoVersionId;
    if (typeof videoVersionId !== "string" || !videoVersionId.trim()) {
      return NextResponse.json(
        { error: "invalid_videoVersionId", message: "videoVersionId must be a non-empty string" },
        { status: 422 },
      );
    }
    const assetsInput = body.assets;
    if (!Array.isArray(assetsInput)) {
      return NextResponse.json(
        { error: "invalid_assets", message: "assets must be an array" },
        { status: 422 },
      );
    }
    for (const item of assetsInput) {
      if (!isAssetDraft(item)) {
        return NextResponse.json(
          { error: "invalid_asset_reference", message: "each asset must contain assetType, assetVersion, referenceUrl, summary" },
          { status: 422 },
        );
      }
    }
    const created = await bulkAddAssetReferences(
      videoVersionId,
      assetsInput as AssetReferenceDraft[],
    );
    return NextResponse.json(
      { accepted: true, createdIds: created.map((item) => item.id), assets: created },
      { status: 201 },
    );
  } catch (error) {
    return contentOperationsError(error);
  }
}