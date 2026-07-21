import { analyzeComments } from "@/server/analysis/commentAnalysis";
import { WechatArticle, WechatComment, WechatCommentStatus } from "@/server/data/types";
import { makeId, readData, writeData } from "@/server/data/store";

type ImportArticle = Pick<WechatArticle, "id" | "title" | "publishedAt" | "url" | "commentEnabled">;
type ImportComment = { id: string; articleId: string; parentCommentId?: string; content: string; createdAt: string; status: WechatCommentStatus };

export async function ingestWechatComments(input: { article: ImportArticle; comments: ImportComment[]; cursor?: string }) {
  const data = await readData(); const now = new Date().toISOString();
  const articles = data.wechatArticles || []; const comments = data.wechatComments || [];
  const article: WechatArticle = { ...input.article, syncedAt: now };
  const articleIndex = articles.findIndex((item) => item.id === article.id);
  if (articleIndex >= 0) articles[articleIndex] = { ...articles[articleIndex], ...article }; else articles.unshift(article);
  let inserted = 0; let duplicates = 0;
  for (const item of input.comments) {
    if (item.articleId !== article.id) throw new Error("评论文章 ID 与导入文章不一致");
    const index = comments.findIndex((current) => current.id === item.id && current.articleId === item.articleId);
    if (index >= 0) { duplicates += 1; comments[index] = { ...comments[index], ...item, syncedAt: now }; }
    else { inserted += 1; comments.unshift({ ...item, syncedAt: now }); }
  }
  const analysis = analyzeComments(comments);
  data.wechatArticles = articles; data.wechatComments = comments; data.commentAnalyses = analysis.evidence;
  data.commentSyncRuns = [{ id: makeId("wechat-sync"), source: "local_import", articleId: article.id, cursor: input.cursor, inserted, duplicates, status: "success", createdAt: now }, ...(data.commentSyncRuns || [])];
  await writeData(data); return { inserted, duplicates, article };
}

export async function getWechatCommentDashboard() {
  const data = await readData(); const comments = data.wechatComments || []; const articles = data.wechatArticles || [];
  return { articles, comments, syncRuns: data.commentSyncRuns || [], ...analyzeComments(comments) };
}
