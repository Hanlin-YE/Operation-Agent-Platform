import { createHash } from "node:crypto";
import { MarketFocus, PublicSourceMode, XiaohongshuSignal } from "@/server/data/types";
import xiaohongshuSnapshot from "../../../data/xiaohongshu-signals.json";

type TikhubSearchItem = {
  note_id?: string;
  title?: string;
  note_title?: string;
  desc?: string;
  content?: string;
  share_url?: string;
  note_url?: string;
  url?: string;
  user?: { user_id?: string; id?: string; nickname?: string; nick_name?: string; profile_url?: string; user_url?: string };
  author?: { user_id?: string; id?: string; nickname?: string; nick_name?: string; profile_url?: string; user_url?: string };
};

type TikhubSearchResponse = { data?: { items?: TikhubSearchItem[] } };
type SourceStatus = { mode: PublicSourceMode; note: string };
type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export interface XiaohongshuSource {
  searchSignals(input: { focus: MarketFocus; limit: number }): Promise<XiaohongshuSignal[]>;
  status(): SourceStatus;
}

const searchQueryByFocus: Record<MarketFocus, string> = {
  all: "空心杯电机 采购",
  robotics: "空心杯电机 机器人",
  medical: "空心杯电机 医疗机器人",
  industrial: "空心杯电机 自动化设备",
  automotive: "空心杯电机 执行器",
  aerospace: "空心杯电机 无人机"
};

function isPublicXiaohongshuUrl(value: string | undefined) {
  try {
    const url = new URL(value || "");
    return url.protocol === "https:" && (url.hostname === "xiaohongshu.com" || url.hostname.endsWith(".xiaohongshu.com"));
  } catch {
    return false;
  }
}

function classifySignal(content: string): Pick<XiaohongshuSignal, "signalType" | "intentLevel" | "recommendedAction"> {
  if (/报价|采购|询价|打样|样品|交期/.test(content)) return { signalType: "需求表达", intentLevel: "高", recommendedAction: "人工核验账号主体、项目阶段和具体规格后，再进入销售线索或技术交流流程。" };
  if (/温升|噪声|寿命|故障|异响|维护/.test(content)) return { signalType: "痛点表达", intentLevel: "中", recommendedAction: "先确认具体应用、工况和现有方案，再评估是否适合技术交流。" };
  return { signalType: "场景观察", intentLevel: "低", recommendedAction: "保留为公开市场观察；补充真实需求和主体信息后再评估。" };
}

function profileUrl(item: TikhubSearchItem) {
  const actor = item.user || item.author;
  const direct = actor?.profile_url || actor?.user_url;
  if (isPublicXiaohongshuUrl(direct)) return direct || "";
  const userId = actor?.user_id || actor?.id;
  return userId ? `https://www.xiaohongshu.com/user/profile/${encodeURIComponent(userId)}` : "";
}

export class TikhubXiaohongshuSource implements XiaohongshuSource {
  private currentStatus: SourceStatus;
  private readonly apiKey: string;
  private readonly endpoint: string;
  private readonly fetcher: Fetcher;

  constructor(options: { apiKey?: string; endpoint?: string; fetcher?: Fetcher } = {}) {
    this.apiKey = options.apiKey ?? process.env.TIKHUB_API_KEY?.trim() ?? "";
    this.endpoint = options.endpoint ?? process.env.TIKHUB_API_BASE_URL?.trim() ?? "https://api.tikhub.dev";
    this.fetcher = options.fetcher ?? fetch;
    this.currentStatus = this.apiKey
      ? { mode: "授权公开数据", note: "通过 Tikhub 授权接口检索公开小红书内容；每条结果均保留原始链接和抓取时间。" }
      : { mode: "未配置", note: "未配置 TIKHUB_API_KEY，系统不会展示或伪造公开信号。" };
  }

  async searchSignals({ focus, limit }: { focus: MarketFocus; limit: number }) {
    if (!this.apiKey) return [];
    const url = new URL("/api/v1/xiaohongshu/app_v2/search_notes", this.endpoint);
    url.search = new URLSearchParams({ keyword: searchQueryByFocus[focus], page: "1", sort_type: "general", note_type: "不限", time_filter: "不限", source: "explore_feed", ai_mode: "0" }).toString();
    try {
      const response = await this.fetcher(url, { headers: { Accept: "application/json", Authorization: `Bearer ${this.apiKey}` }, cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json() as TikhubSearchResponse;
      const collectedAt = new Date().toISOString();
      const records = payload.data?.items || [];
      const signals = records.flatMap((item) => {
        const noteUrl = item.share_url || item.note_url || item.url || "";
        const excerpt = (item.desc || item.content || "").trim();
        const account = item.user || item.author;
        if (!isPublicXiaohongshuUrl(noteUrl) || !excerpt) return [];
        const classification = classifySignal(excerpt);
        const id = item.note_id || createHash("sha256").update(noteUrl).digest("hex").slice(0, 16);
        return [{
          id: `xhs-${id}`,
          accountName: account?.nickname || account?.nick_name || "公开账号（待核验）",
          accountType: "待核验" as const,
          title: (item.title || item.note_title || "公开笔记").trim(),
          noteUrl,
          profileUrl: profileUrl(item),
          publishedAt: collectedAt.slice(0, 10),
          scenario: focus,
          excerpt,
          evidenceLabel: "公开资料" as const,
          sourceName: "小红书公开内容（Tikhub 授权接口）",
          sourceStatus: "授权接口返回" as const,
          collectedAt,
          ...classification
        }];
      });
      return signals.slice(0, Math.max(1, Math.min(limit, 10)));
    } catch {
      this.currentStatus = { mode: "接口异常", note: "授权公开数据源暂时无法访问，本次分析未写入任何公开信号。" };
      return [];
    }
  }

  status() {
    return this.currentStatus;
  }
}

const collectedSignals = xiaohongshuSnapshot as unknown as XiaohongshuSignal[];

export class SnapshotXiaohongshuSource implements XiaohongshuSource {
  async searchSignals({ focus, limit }: { focus: MarketFocus; limit: number }) {
    const scoped = focus === "all" ? collectedSignals : collectedSignals.filter((item) => item.scenario === focus);
    return scoped.slice(0, Math.max(1, Math.min(limit, 50)));
  }

  status(): SourceStatus {
    return {
      mode: "本地真实数据",
      note: `已读取本地线索 Agent 的 ${collectedSignals.length} 条公开小红书采集快照；链接已去除临时鉴权参数，触达前仍需人工核验。`
    };
  }
}

export function createXiaohongshuSource(): XiaohongshuSource {
  return process.env.TIKHUB_API_KEY?.trim()
    ? new TikhubXiaohongshuSource()
    : collectedSignals.length ? new SnapshotXiaohongshuSource() : new TikhubXiaohongshuSource();
}
