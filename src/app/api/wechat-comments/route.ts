import { NextResponse } from "next/server";
import { getWechatCommentDashboard, ingestWechatComments } from "@/server/repositories/wechatComments";
import { LocalWechatCommentsSource, OfficialWechatCommentsSource } from "@/server/sources/wechatComments";

export async function GET() {
  const dashboard = await getWechatCommentDashboard();
  return NextResponse.json({ ...dashboard, source: (process.env.WECHAT_SOURCE === "official" ? new OfficialWechatCommentsSource() : new LocalWechatCommentsSource()).status() });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body?.article?.id || !body?.article?.title || !body?.article?.publishedAt || !Array.isArray(body.comments)) return NextResponse.json({ error: "article.id、article.title、article.publishedAt 和 comments 必填" }, { status: 400 });
    if (body.comments.length > 5000) return NextResponse.json({ error: "单次最多导入 5000 条评论" }, { status: 400 });
    const result = await ingestWechatComments(body);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "评论同步失败" }, { status: 400 });
  }
}
