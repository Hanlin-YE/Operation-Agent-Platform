"use client";

import { ExternalLink, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { MarketFocus, XiaohongshuSignal } from "@/server/data/types";

const scenarioLabels: Record<MarketFocus, string> = {
  all: "全部场景",
  robotics: "机器人/灵巧手",
  medical: "医疗精密设备",
  industrial: "工业自动化",
  automotive: "汽车电子",
  aerospace: "无人机/航空航天"
};

const followupLabels = ["全部状态", "待联系", "已联系", "跟进中", "无效"] as const;

function formatDate(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("zh-CN");
}

export function XiaohongshuSignalsTable({ signals }: { signals: XiaohongshuSignal[] }) {
  const [query, setQuery] = useState("");
  const [intent, setIntent] = useState<"全部意向" | XiaohongshuSignal["intentLevel"]>("全部意向");
  const [scenario, setScenario] = useState<MarketFocus>("all");
  const [followup, setFollowup] = useState<(typeof followupLabels)[number]>("全部状态");

  const filtered = useMemo(() => {
    const keyword = query.trim().toLocaleLowerCase();
    return signals.filter((signal) => {
      const searchable = [signal.accountName, signal.accountType, signal.title, signal.excerpt, signal.signalType, signal.reason, signal.evidence]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase();
      return (intent === "全部意向" || signal.intentLevel === intent)
        && (scenario === "all" || signal.scenario === scenario)
        && (followup === "全部状态" || signal.followupStatus === followup)
        && (!keyword || searchable.includes(keyword));
    });
  }, [followup, intent, query, scenario, signals]);

  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">Xiaohongshu Lead Snapshot</p>
          <h1>小红书公开线索表</h1>
          <p className="subtle">已采集的公开笔记和评论统一入表。意向等级是线索判断，不等同于已确认采购需求。</p>
        </div>
        <div className="panel signal-table-summary" aria-label="线索统计">
          <strong>{signals.length}</strong><span>条公开线索</span>
          <span className="subtle">高意向 {signals.filter((item) => item.intentLevel === "高").length} 条</span>
        </div>
      </div>

      <section className="panel" style={{ marginTop: 16 }}>
        <div className="signal-table-toolbar">
          <label className="signal-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索账号、标题、公开证据" aria-label="搜索小红书线索" /></label>
          <select value={intent} onChange={(event) => setIntent(event.target.value as typeof intent)} aria-label="按意向筛选">
            <option>全部意向</option><option>高</option><option>中</option><option>低</option>
          </select>
          <select value={scenario} onChange={(event) => setScenario(event.target.value as MarketFocus)} aria-label="按场景筛选">
            {Object.entries(scenarioLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <select value={followup} onChange={(event) => setFollowup(event.target.value as typeof followup)} aria-label="按跟进状态筛选">
            {followupLabels.map((value) => <option key={value}>{value}</option>)}
          </select>
        </div>
        <p className="subtle signal-table-count">显示 {filtered.length} / {signals.length} 条。笔记、主页均为原始公开链接；销售触达前需人工核验主体、需求与平台合规。</p>
        <div className="content-table-scroll">
          <table className="table xiaohongshu-signals-table">
            <thead><tr><th>账号 / 类型</th><th>场景</th><th>公开信号</th><th>意向</th><th>公开证据</th><th>原始链接</th><th>采集时间</th><th>跟进建议</th></tr></thead>
            <tbody>
              {filtered.map((signal) => <tr key={signal.id}>
                <td><strong>{signal.accountName}</strong><p className="subtle">{signal.accountType}</p></td>
                <td>{scenarioLabels[signal.scenario]}</td>
                <td><strong>{signal.signalType}</strong><p className="subtle">{signal.title}</p></td>
                <td><div className="badge-row"><span className={`badge grade-${signal.intentLevel === "高" ? "A" : signal.intentLevel === "中" ? "B" : "C"}`}>{signal.intentLevel}意向</span><span className="badge">{signal.followupStatus || "待核验"}</span></div></td>
                <td><p className="signal-evidence">{signal.excerpt.replace(/^\[公开资料\]\s*/, "")}</p>{signal.reason ? <p className="subtle">判断：{signal.reason}</p> : null}</td>
                <td><div className="signal-links"><a href={signal.noteUrl} target="_blank" rel="noreferrer">笔记 <ExternalLink size={12} /></a><a href={signal.profileUrl} target="_blank" rel="noreferrer">主页 <ExternalLink size={12} /></a></div></td>
                <td>{formatDate(signal.collectedAt || signal.publishedAt)}</td>
                <td><p>{signal.recommendedAction}</p></td>
              </tr>)}
              {!filtered.length ? <tr><td colSpan={8}><div className="content-table-empty">没有符合当前筛选条件的公开线索</div></td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
