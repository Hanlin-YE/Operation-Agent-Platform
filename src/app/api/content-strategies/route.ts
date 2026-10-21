import { requireLocalMutation } from "@/server/http/local";
import { NextResponse } from "next/server";
import { submitTask } from "@/server/tasks/submit";
import { saveAttachment } from "@/server/storage/attachments";
import { modelSnapshot } from "@/server/models/settings";
import { listContentStrategies } from "@/server/repositories/contentStrategies";
import { ContentStrategyPlatform } from "@/server/data/types";

export const runtime = "nodejs";
const platforms = new Set<ContentStrategyPlatform>(["xiaohongshu", "wechat", "douyin", "other"]);

export async function GET() { return NextResponse.json(await listContentStrategies()); }

export async function POST(request: Request) {
  try {
  requireLocalMutation(request);
    const form = await request.formData();
    const files = form.getAll("images").filter((value): value is File => value instanceof File && value.size > 0);
    if (files.length > 3) return NextResponse.json({ error: "最多上传 3 张图片样本。" }, { status: 422 });
    if (files.some((file) => !file.type.startsWith("image/") || file.size > 5 * 1024 * 1024)) return NextResponse.json({ error: "图片须为 5MB 以内的图片文件。" }, { status: 422 });
    const platform = String(form.get("platform") || "other") as ContentStrategyPlatform;
    if (!platforms.has(platform)) return NextResponse.json({ error: "不支持的内容平台。" }, { status: 422 });
    const metrics = Object.fromEntries(["views", "likes", "comments", "saves", "shares"].flatMap((key) => {
      const value = Number(form.get(key)); return Number.isFinite(value) && value >= 0 ? [[key, value]] : [];
    }));
    modelSnapshot("content");
    const imagePaths = await Promise.all(files.map(async file=>({mimeType:file.type,path:await saveAttachment(new Uint8Array(await file.arrayBuffer()),file.name.split(".").pop() || "bin")})));
    const record = submitTask("content-strategy", {
      platform, title: String(form.get("title") || ""), content: String(form.get("content") || ""), sourceUrl: String(form.get("sourceUrl") || ""),
      metrics, images: files.map((file) => ({ filename: file.name, mimeType: file.type, size: file.size })), imagePaths
    });
    return NextResponse.json(record, { status: 202 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "无法创建内容策略包。" }, { status: 422 });
  }
}
