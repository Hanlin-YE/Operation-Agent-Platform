import { MarketFocus, XiaohongshuSignal } from "@/server/data/types";
import xiaohongshuSnapshot from "../../../data/xiaohongshu-signals.json";

export interface XiaohongshuSource {
  searchSignals(input: { focus: MarketFocus; limit: number }): Promise<XiaohongshuSignal[]>;
  status(): { mode: "本地真实数据" | "本地演示数据" | "未配置"; note: string };
}

const signals: XiaohongshuSignal[] = [
  { id: "xhs-demo-robotics-01", accountName: "灵巧手研发日志", accountType: "团队", title: "灵巧手样机第 3 次改版：关节模组温升怎么压", noteUrl: "https://www.xiaohongshu.com/explore/demo-robotics-01", profileUrl: "https://www.xiaohongshu.com/user/profile/demo-robotics", publishedAt: "2026-07-12", scenario: "robotics", signalType: "痛点表达", excerpt: "[公开资料] 正在比较关节驱动方案，现有样机在连续动作后需要处理温升与尺寸约束。", intentLevel: "高", evidenceLabel: "公开资料", recommendedAction: "人工核验团队主体和项目阶段后，以样机工况与测试方法切入技术交流。" },
  { id: "xhs-demo-robotics-02", accountName: "机器人零部件观察", accountType: "个人开发者", title: "做一只桌面机械手，电机选型避坑", noteUrl: "https://www.xiaohongshu.com/explore/demo-robotics-02", profileUrl: "https://www.xiaohongshu.com/user/profile/demo-maker", publishedAt: "2026-07-10", scenario: "robotics", signalType: "需求表达", excerpt: "[公开资料] 询问小体积驱动的响应、噪声和寿命如何取舍；是否为采购需求仍待核验。", intentLevel: "中", evidenceLabel: "公开资料", recommendedAction: "先确认其为产品开发、教学项目还是个人制作，再决定是否进入销售线索池。" },
  { id: "xhs-demo-automotive-01", accountName: "座舱执行器实验室", accountType: "待核验", title: "电动出风口执行器的异响排查记录", noteUrl: "https://www.xiaohongshu.com/explore/demo-auto-01", profileUrl: "https://www.xiaohongshu.com/user/profile/demo-auto", publishedAt: "2026-07-11", scenario: "automotive", signalType: "痛点表达", excerpt: "[公开资料] 内容提及低噪声、重复动作一致性与验证周期；与空心杯适配性属于 [推断]。", intentLevel: "中", evidenceLabel: "推断", recommendedAction: "先确认具体执行器、车规要求和既有供应链，不能直接承诺产品适配。" },
  { id: "xhs-demo-medical-01", accountName: "医疗器械产品笔记", accountType: "企业", title: "精密微泵原型机的长期运行测试", noteUrl: "https://www.xiaohongshu.com/explore/demo-medical-01", profileUrl: "https://www.xiaohongshu.com/user/profile/demo-medical", publishedAt: "2026-07-09", scenario: "medical", signalType: "场景观察", excerpt: "[公开资料] 展示精密运动与可靠性验证场景，未出现采购或替换表达。", intentLevel: "中", evidenceLabel: "公开资料", recommendedAction: "补充认证阶段、关键部件规格和供应商准入信息后再评估。" },
  { id: "xhs-demo-industrial-01", accountName: "设备工程师小周", accountType: "个人开发者", title: "自动化设备调试日常", noteUrl: "https://www.xiaohongshu.com/explore/demo-industrial-01", profileUrl: "https://www.xiaohongshu.com/user/profile/demo-industrial", publishedAt: "2026-07-08", scenario: "industrial", signalType: "竞品评论", excerpt: "[公开资料] 在相关电机笔记下询问交期与维护频率，账号主体和真实项目均待核验。", intentLevel: "低", evidenceLabel: "公开资料", recommendedAction: "仅保留为审计线索，不进入默认销售触达名单。" }
];

const collectedSignals = xiaohongshuSnapshot as unknown as XiaohongshuSignal[];

export class LocalXiaohongshuSource implements XiaohongshuSource {
  async searchSignals({ focus, limit }: { focus: MarketFocus; limit: number }) {
    const scoped = focus === "all" ? signals : signals.filter((item) => item.scenario === focus);
    return scoped.slice(0, Math.max(1, Math.min(limit, 10)));
  }

  status() {
    return { mode: "本地演示数据" as const, note: "已接入 XiaohongshuSource 抽象；当前为本地固定样本，不配置、不调用任何真实小红书 API。" };
  }
}

/**
 * Read-only snapshot exported by the local lead agent. It keeps the website
 * independent from TikHub credentials while preserving the public evidence
 * links and the lead-agent's review status.
 */
export class SnapshotXiaohongshuSource implements XiaohongshuSource {
  async searchSignals({ focus, limit }: { focus: MarketFocus; limit: number }) {
    const scoped = focus === "all" ? collectedSignals : collectedSignals.filter((item) => item.scenario === focus);
    return scoped.slice(0, Math.max(1, Math.min(limit, 50)));
  }

  status() {
    return {
      mode: "本地真实数据" as const,
      note: `已读取本地线索 Agent 的 ${collectedSignals.length} 条公开小红书采集快照；链接已去除临时鉴权参数，触达前仍需人工核验。`
    };
  }
}

export function createXiaohongshuSource(): XiaohongshuSource {
  return collectedSignals.length ? new SnapshotXiaohongshuSource() : new LocalXiaohongshuSource();
}
