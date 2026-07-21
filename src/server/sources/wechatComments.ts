import { WechatCommentStatus } from "@/server/data/types";

export type WechatCommentInput = { id: string; articleId: string; parentCommentId?: string; content: string; createdAt: string; status: WechatCommentStatus };
export interface WechatCommentsSource {
  listComments(input: { articleId: string; cursor?: string; limit?: number }): Promise<{ comments: WechatCommentInput[]; nextCursor?: string }>;
  status(): { mode: "本地演示数据" | "官方 API 未配置"; note: string };
}

export class LocalWechatCommentsSource implements WechatCommentsSource {
  async listComments({ articleId, limit = 100 }: { articleId: string; cursor?: string; limit?: number }) {
    return { comments: [], nextCursor: undefined, articleId, limit };
  }
  status() { return { mode: "本地演示数据" as const, note: "只接受运营人员主动导入的 JSON；未连接微信后台，不进行抓取或模拟登录。" }; }
}

export class OfficialWechatCommentsSource implements WechatCommentsSource {
  async listComments(_input: { articleId: string; cursor?: string; limit?: number }): Promise<{ comments: WechatCommentInput[]; nextCursor?: string }> { throw new Error("官方微信评论 API 适配器尚未配置，请先完成账号权限与服务端密钥配置。"); }
  status() { return { mode: "官方 API 未配置" as const, note: "生产环境应在独立采集服务中接入官方 API，并配置限流、游标和重试。" }; }
}
