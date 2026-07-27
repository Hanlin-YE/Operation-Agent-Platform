"use client";

import { useMemo, useState } from "react";
import { ArrowUpRight, Clock, Sparkles, Video } from "lucide-react";

type PlanStatus = "draft" | "reviewing" | "ready" | "in_progress";
type Period = "day" | "week" | "month";

type CreationPlan = {
  id: string;
  title: string;
  categoryLabel: string;
  status: PlanStatus;
  createdAt: string;
  duration: string;
  excerpt: string;
};

function hoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 3_600_000).toISOString();
}

function daysAgo(days: number, hours = 0): string {
  return new Date(Date.now() - days * 86_400_000 - hours * 3_600_000).toISOString();
}

function formatTime(iso: string): string {
  const elapsedHours = (Date.now() - new Date(iso).getTime()) / 3_600_000;
  if (elapsedHours < 1) return "刚刚创建";
  if (elapsedHours < 24) return `${Math.floor(elapsedHours)} 小时前创建`;
  const elapsedDays = elapsedHours / 24;
  if (elapsedDays < 2) return "昨天创建";
  if (elapsedDays < 7) return `${Math.floor(elapsedDays)} 天前创建`;
  return new Date(iso).toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" });
}

const mockPlans: CreationPlan[] = [
  { id: "plan-001", title: "自超滑电机 ZT-300 系列 30s 产品广告片", categoryLabel: "产品广告", status: "ready", createdAt: hoursAgo(2), duration: "0:30", excerpt: "已明确卖点、目标场景与 30 秒叙事节奏，等待进入视频生产。" },
  { id: "plan-002", title: "小红书短视频：电机节能小知识", categoryLabel: "知识科普", status: "in_progress", createdAt: hoursAgo(5), duration: "0:45", excerpt: "面向非专业受众的节能科普，正在完善镜头节奏与口播表达。" },
  { id: "plan-003", title: "工厂实地探访 Vlog", categoryLabel: "工厂探访", status: "reviewing", createdAt: hoursAgo(10), duration: "2:15", excerpt: "围绕真实工况和运行表现整理采访提纲、镜头清单与审核重点。" },
  { id: "plan-004", title: "钢铁行业电机选型短片", categoryLabel: "行业方案", status: "draft", createdAt: hoursAgo(15), duration: "1:00", excerpt: "从客户常见选型问题出发，待补充应用场景和技术证据。" },
  { id: "plan-005", title: "品牌介绍视频：技术创新与行业深耕", categoryLabel: "品牌介绍", status: "ready", createdAt: daysAgo(1, 3), duration: "1:00", excerpt: "品牌故事、关键技术与代表场景已沉淀为可执行的视频创作计划。" },
  { id: "plan-006", title: "客户节能改造案例复盘", categoryLabel: "客户案例", status: "reviewing", createdAt: daysAgo(2, 8), duration: "1:30", excerpt: "待核对改造数据与客户表述后，再确认视频脚本与采访素材。" },
  { id: "plan-007", title: "自超滑技术原理科普动画", categoryLabel: "技术科普", status: "draft", createdAt: daysAgo(4, 4), duration: "1:45", excerpt: "将技术原理拆解为可视化段落，等待确定面向的受众与讲解深度。" },
  { id: "plan-008", title: "上海工博会参展回顾", categoryLabel: "展会回顾", status: "ready", createdAt: daysAgo(6, 6), duration: "3:20", excerpt: "已完成重点展品、客户交流与品牌亮点的镜头编排。" },
  { id: "plan-009", title: "技术总监访谈：超滑技术详解", categoryLabel: "专家访谈", status: "in_progress", createdAt: daysAgo(9, 5), duration: "4:50", excerpt: "正在根据访谈提纲整理问题顺序、证据材料与拍摄分镜。" },
];

const STATUS_LABEL: Record<PlanStatus, string> = {
  draft: "待完善",
  reviewing: "审核中",
  ready: "待创作",
  in_progress: "策划中",
};

const PERIOD_RANGE: Record<Period, number> = {
  day: 86_400_000,
  week: 7 * 86_400_000,
  month: 30 * 86_400_000,
};

const PERIOD_LABELS: { key: Period; label: string }[] = [
  { key: "day", label: "日" },
  { key: "week", label: "周" },
  { key: "month", label: "月" },
];

export function AigcShowcaseBoard() {
  const [period, setPeriod] = useState<Period>("day");
  const filteredPlans = useMemo(() => {
    const cutoff = Date.now() - PERIOD_RANGE[period];
    return mockPlans.filter((plan) => new Date(plan.createdAt).getTime() >= cutoff);
  }, [period]);

  const stats = useMemo(() => ({
    total: filteredPlans.length,
    draft: filteredPlans.filter((plan) => plan.status === "draft").length,
    reviewing: filteredPlans.filter((plan) => plan.status === "reviewing").length,
    ready: filteredPlans.filter((plan) => plan.status === "ready").length,
  }), [filteredPlans]);

  return (
    <section className="panel showcase-section" aria-label="视频创作计划">
      <div className="showcase-header">
        <div className="showcase-title">
          <Sparkles size={18} />
          <div>
            <p className="eyebrow">AI 内容规划</p>
            <h2>视频创作计划</h2>
          </div>
        </div>
        <div className="showcase-filter">
          {PERIOD_LABELS.map(({ key, label }) => (
            <button key={key} className={period === key ? "active" : ""} onClick={() => setPeriod(key)} type="button">
              {label}
            </button>
          ))}
        </div>
        <a href="/aigc?type=video" className="showcase-more" aria-label="查看全部视频创作计划">
          查看全部 <ArrowUpRight size={14} />
        </a>
      </div>

      <div className="showcase-stats" aria-label="创作计划统计">
        <div className="showcase-stat-item"><strong>{stats.total}</strong><span>项计划</span></div>
        <div className="showcase-stat-item type-video"><Video size={15} /><strong>{stats.draft}</strong><span>待完善</span></div>
        <div className="showcase-stat-item type-review"><Clock size={15} /><strong>{stats.reviewing}</strong><span>审核中</span></div>
        <div className="showcase-stat-item type-ready"><Sparkles size={15} /><strong>{stats.ready}</strong><span>待创作</span></div>
      </div>

      {filteredPlans.length > 0 ? (
        <div className="showcase-grid">
          {filteredPlans.map((plan) => (
            <article key={plan.id} className="showcase-card type-video">
              <div className="showcase-card-top">
                <span className="showcase-type-badge type-video"><Video size={12} />视频计划</span>
                <span className={`showcase-status status-${plan.status}`}>{STATUS_LABEL[plan.status]}</span>
              </div>
              <h3 className="showcase-card-title">{plan.title}</h3>
              <p className="showcase-card-excerpt">{plan.excerpt}</p>
              <div className="showcase-card-meta"><span className="showcase-category">{plan.categoryLabel}</span></div>
              <div className="showcase-card-footer">
                <span className="showcase-time"><Clock size={12} />{formatTime(plan.createdAt)}</span>
                <span className="showcase-duration">预计 {plan.duration}</span>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="home-empty"><Video size={19} /><p>该时段暂无视频创作计划</p><a href="/aigc?type=video">创建视频计划</a></div>
      )}
    </section>
  );
}
