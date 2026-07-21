"use client";

import { useMemo, useState } from "react";
import {
  ArrowUpRight,
  Clock,
  Eye,
  FileText,
  Image as ImageIcon,
  Sparkles,
  TrendingUp,
  Video,
} from "lucide-react";

/* ---------- 类型 ---------- */
type ContentType = "text" | "image" | "video";
type ContentStatus = "succeeded" | "running" | "failed" | "queued";
type Period = "day" | "week" | "month";

type ShowcaseItem = {
  id: string;
  type: ContentType;
  title: string;
  category: string;
  categoryLabel: string;
  platform: string;
  platformLabel: string;
  status: ContentStatus;
  createdAt: string;
  views: number;
  duration?: string;
  excerpt: string;
};

/* ---------- 时间工具 ---------- */
function hoursAgo(h: number): string {
  return new Date(Date.now() - h * 3_600_000).toISOString();
}
function daysAgo(d: number, h = 0): string {
  return new Date(Date.now() - d * 86_400_000 - h * 3_600_000).toISOString();
}

function formatTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const hours = diff / 3_600_000;
  if (hours < 1) return "刚刚";
  if (hours < 24) return `${Math.floor(hours)}小时前`;
  const days = hours / 24;
  if (days < 2) return "昨天";
  if (days < 7) return `${Math.floor(days)}天前`;
  return new Date(iso).toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" });
}

function formatNumber(n: number): string {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}w`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

/* ---------- Mock 数据 ---------- */
const mockItems: ShowcaseItem[] = [
  /* 今天 */
  { id: "s-001", type: "video", title: "自超滑电机 ZT-300 系列 30s 广告片", category: "product_ad", categoryLabel: "产品广告", platform: "runninghub", platformLabel: "RunningHub", status: "succeeded", createdAt: hoursAgo(2), views: 1284, duration: "0:30", excerpt: "聚焦自超滑轴承技术的节能效果，30 秒快节奏展示产品核心卖点。" },
  { id: "s-002", type: "text", title: "自超滑技术在工业节能场景的价值解读", category: "product_ad", categoryLabel: "产品解读", platform: "tapnow", platformLabel: "TapNow", status: "succeeded", createdAt: hoursAgo(4), views: 856, excerpt: "深度解析自超滑轴承技术如何降低电机能耗 15%-30%。" },
  { id: "s-003", type: "image", title: "ZT-300 系列产品三维渲染图", category: "product_showcase", categoryLabel: "产品展示", platform: "runninghub", platformLabel: "RunningHub", status: "succeeded", createdAt: hoursAgo(5), views: 432, excerpt: "4K 高清渲染，展示产品外观与结构细节。" },
  { id: "s-004", type: "video", title: "小红书短视频：电机节能小知识", category: "xiaohongshu", categoryLabel: "小红书", platform: "tapnow", platformLabel: "TapNow", status: "running", createdAt: hoursAgo(6), views: 0, duration: "0:45", excerpt: "面向 C 端用户的节能科普，轻松幽默风格。" },
  { id: "s-005", type: "text", title: "钢铁行业电机选型口播稿", category: "product_ad", categoryLabel: "口播稿", platform: "tapnow", platformLabel: "TapNow", status: "succeeded", createdAt: hoursAgo(7), views: 203, excerpt: "面向钢铁行业客户的电机选型建议，3 分钟口播。" },
  { id: "s-006", type: "image", title: "节能效果对比信息图", category: "product_showcase", categoryLabel: "信息图", platform: "runninghub", platformLabel: "RunningHub", status: "succeeded", createdAt: hoursAgo(9), views: 678, excerpt: "传统电机 vs 自超滑电机能耗对比数据可视化。" },
  { id: "s-007", type: "video", title: "工厂实地探访 Vlog", category: "product_showcase", categoryLabel: "工厂探访", platform: "runninghub", platformLabel: "RunningHub", status: "succeeded", createdAt: hoursAgo(11), views: 2105, duration: "2:15", excerpt: "实地拍摄自超滑电机在钢厂车间的运行情况。" },
  { id: "s-008", type: "text", title: "客户案例：某钢厂节能改造纪实", category: "product_ad", categoryLabel: "客户案例", platform: "tapnow", platformLabel: "TapNow", status: "succeeded", createdAt: hoursAgo(13), views: 341, excerpt: "记录某大型钢厂采用自超滑电机后年节能 200 万度电的改造过程。" },

  /* 本周（非今天）*/
  { id: "s-009", type: "video", title: "品牌介绍视频 - 60s", category: "brand_intro", categoryLabel: "品牌介绍", platform: "runninghub", platformLabel: "RunningHub", status: "succeeded", createdAt: daysAgo(1, 3), views: 3421, duration: "1:00", excerpt: "企业品牌故事，展示技术创新与行业深耕历程。" },
  { id: "s-010", type: "image", title: "品牌宣传海报 - 工业之美", category: "brand_intro", categoryLabel: "品牌海报", platform: "runninghub", platformLabel: "RunningHub", status: "succeeded", createdAt: daysAgo(1, 8), views: 892, excerpt: "极简工业风海报，突出品牌主张。" },
  { id: "s-011", type: "text", title: "Q3 市场竞品分析报告摘要", category: "product_ad", categoryLabel: "竞品分析", platform: "tapnow", platformLabel: "TapNow", status: "succeeded", createdAt: daysAgo(2, 10), views: 156, excerpt: "对比国内 5 家主要电机厂商的产品线与定价策略。" },
  { id: "s-012", type: "video", title: "客户见证视频 - 节能改造前后对比", category: "product_showcase", categoryLabel: "客户见证", platform: "runninghub", platformLabel: "RunningHub", status: "succeeded", createdAt: daysAgo(2, 14), views: 1876, duration: "1:30", excerpt: "某水泥厂技改前后能耗数据对比，客户主管出镜。" },
  { id: "s-013", type: "image", title: "小红书封面图 - 节能小课堂", category: "xiaohongshu", categoryLabel: "社媒封面", platform: "runninghub", platformLabel: "RunningHub", status: "succeeded", createdAt: daysAgo(3, 6), views: 1203, excerpt: "清新手绘风，适合小红书信息流。" },
  { id: "s-014", type: "text", title: "工业电机能效等级对比分析", category: "product_ad", categoryLabel: "行业分析", platform: "tapnow", platformLabel: "TapNow", status: "succeeded", createdAt: daysAgo(3, 11), views: 489, excerpt: "IE3 / IE4 / IE5 能效标准对比，附自超滑产品定位说明。" },
  { id: "s-015", type: "video", title: "自超滑技术原理科普动画", category: "brand_intro", categoryLabel: "技术科普", platform: "runninghub", platformLabel: "RunningHub", status: "failed", createdAt: daysAgo(4, 9), views: 0, duration: "1:45", excerpt: "用动画方式解释自超滑轴承的工作原理。" },
  { id: "s-016", type: "image", title: "产品参数表信息图", category: "product_showcase", categoryLabel: "参数信息图", platform: "runninghub", platformLabel: "RunningHub", status: "succeeded", createdAt: daysAgo(5, 7), views: 567, excerpt: "ZT-300 系列全型号参数一览，适合销售场景。" },
  { id: "s-017", type: "text", title: "面向化工行业的电机节能方案", category: "product_ad", categoryLabel: "行业方案", platform: "tapnow", platformLabel: "TapNow", status: "succeeded", createdAt: daysAgo(5, 13), views: 278, excerpt: "化工行业典型场景下的电机节能改造方案。" },
  { id: "s-018", type: "video", title: "展会回顾视频 - 上海工博会", category: "brand_intro", categoryLabel: "展会回顾", platform: "runninghub", platformLabel: "RunningHub", status: "succeeded", createdAt: daysAgo(6, 10), views: 4532, duration: "3:20", excerpt: "工博会展台盛况回顾，含客户访谈片段。" },

  /* 本月（非本周）*/
  { id: "s-019", type: "text", title: "自超滑技术发展白皮书摘要", category: "brand_intro", categoryLabel: "白皮书", platform: "tapnow", platformLabel: "TapNow", status: "succeeded", createdAt: daysAgo(8, 5), views: 892, excerpt: "技术发展脉络与未来趋势展望。" },
  { id: "s-020", type: "image", title: "产品系列全家福海报", category: "product_showcase", categoryLabel: "产品海报", platform: "runninghub", platformLabel: "RunningHub", status: "succeeded", createdAt: daysAgo(9, 8), views: 1023, excerpt: "ZT 系列全产品线视觉展示。" },
  { id: "s-021", type: "video", title: "技术总监访谈 - 超滑技术详解", category: "brand_intro", categoryLabel: "专家访谈", platform: "runninghub", platformLabel: "RunningHub", status: "succeeded", createdAt: daysAgo(10, 6), views: 2341, duration: "4:50", excerpt: "技术总监深度解读自超滑技术核心优势。" },
  { id: "s-022", type: "text", title: "水泥行业电机选型指南", category: "product_ad", categoryLabel: "行业指南", platform: "tapnow", platformLabel: "TapNow", status: "succeeded", createdAt: daysAgo(12, 9), views: 445, excerpt: "水泥行业电机选型的关键参数与决策建议。" },
  { id: "s-023", type: "image", title: "节能效果数据可视化大图", category: "product_showcase", categoryLabel: "数据可视化", platform: "runninghub", platformLabel: "RunningHub", status: "succeeded", createdAt: daysAgo(14, 7), views: 1567, excerpt: "全年节能数据汇总可视化。" },
  { id: "s-024", type: "video", title: "年度品牌回顾片", category: "brand_intro", categoryLabel: "年度回顾", platform: "runninghub", platformLabel: "RunningHub", status: "succeeded", createdAt: daysAgo(15, 10), views: 5678, duration: "5:30", excerpt: "全年重要时刻回顾。" },
  { id: "s-025", type: "text", title: "客户 FAQ 问答集锦", category: "product_ad", categoryLabel: "FAQ", platform: "tapnow", platformLabel: "TapNow", status: "succeeded", createdAt: daysAgo(17, 8), views: 334, excerpt: "高频客户问题汇总解答。" },
  { id: "s-026", type: "image", title: "产品安装指南图解", category: "product_showcase", categoryLabel: "安装指南", platform: "runninghub", platformLabel: "RunningHub", status: "succeeded", createdAt: daysAgo(19, 6), views: 789, excerpt: "图文并茂的安装步骤说明。" },
  { id: "s-027", type: "video", title: "产线自动化应用案例视频", category: "product_showcase", categoryLabel: "应用案例", platform: "runninghub", platformLabel: "RunningHub", status: "succeeded", createdAt: daysAgo(21, 9), views: 1890, duration: "2:40", excerpt: "某汽车厂产线自动化中自超滑电机的应用。" },
  { id: "s-028", type: "text", title: "行业政策解读 - 双碳目标下的电机节能", category: "brand_intro", categoryLabel: "政策解读", platform: "tapnow", platformLabel: "TapNow", status: "succeeded", createdAt: daysAgo(23, 7), views: 612, excerpt: "解读双碳政策对高效电机市场的影响。" },
  { id: "s-029", type: "image", title: "产品认证证书信息图", category: "product_showcase", categoryLabel: "资质展示", platform: "runninghub", platformLabel: "RunningHub", status: "succeeded", createdAt: daysAgo(25, 8), views: 456, excerpt: "CE / 能效认证等资质展示。" },
  { id: "s-030", type: "video", title: "客户回访纪录片 - 半年节能效果跟踪", category: "product_showcase", categoryLabel: "客户回访", platform: "runninghub", platformLabel: "RunningHub", status: "succeeded", createdAt: daysAgo(28, 10), views: 3456, duration: "3:15", excerpt: "半年后回访客户，记录实际节能效果。" },
];

/* ---------- 元数据 ---------- */
const TYPE_META: Record<ContentType, { icon: typeof FileText; label: string }> = {
  text: { icon: FileText, label: "文本" },
  image: { icon: ImageIcon, label: "图片" },
  video: { icon: Video, label: "视频" },
};

const STATUS_LABEL: Record<ContentStatus, string> = {
  succeeded: "已完成",
  running: "生成中",
  failed: "失败",
  queued: "排队中",
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

/* ---------- 组件 ---------- */
export function AigcShowcaseBoard() {
  const [period, setPeriod] = useState<Period>("day");

  const filteredItems = useMemo(() => {
    const cutoff = Date.now() - PERIOD_RANGE[period];
    return mockItems
      .filter((item) => new Date(item.createdAt).getTime() >= cutoff)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [period]);

  const stats = useMemo(
    () => ({
      total: filteredItems.length,
      text: filteredItems.filter((i) => i.type === "text").length,
      image: filteredItems.filter((i) => i.type === "image").length,
      video: filteredItems.filter((i) => i.type === "video").length,
      totalViews: filteredItems.reduce((sum, i) => sum + i.views, 0),
    }),
    [filteredItems],
  );

  return (
    <section className="panel showcase-section" aria-label="AI 内容展板">
      {/* 头部 */}
      <div className="showcase-header">
        <div className="showcase-title">
          <Sparkles size={18} />
          <div>
            <p className="eyebrow">AI 内容展板</p>
            <h2>已生产 AI 内容</h2>
          </div>
        </div>
        <div className="showcase-filter">
          {PERIOD_LABELS.map(({ key, label }) => (
            <button
              key={key}
              className={period === key ? "active" : ""}
              onClick={() => setPeriod(key)}
              type="button"
            >
              {label}
            </button>
          ))}
        </div>
        <a href="/aigc" className="showcase-more" aria-label="查看全部 AI 内容">
          查看全部 <ArrowUpRight size={14} />
        </a>
      </div>

      {/* 统计概览 */}
      <div className="showcase-stats">
        <div className="showcase-stat-item">
          <strong>{stats.total}</strong>
          <span>总内容</span>
        </div>
        <div className="showcase-stat-item type-text">
          <FileText size={15} />
          <strong>{stats.text}</strong>
          <span>文本</span>
        </div>
        <div className="showcase-stat-item type-image">
          <ImageIcon size={15} />
          <strong>{stats.image}</strong>
          <span>图片</span>
        </div>
        <div className="showcase-stat-item type-video">
          <Video size={15} />
          <strong>{stats.video}</strong>
          <span>视频</span>
        </div>
        <div className="showcase-stat-item type-views">
          <TrendingUp size={15} />
          <strong>{formatNumber(stats.totalViews)}</strong>
          <span>总浏览</span>
        </div>
      </div>

      {/* 内容卡片网格 */}
      {filteredItems.length > 0 ? (
        <div className="showcase-grid">
          {filteredItems.map((item) => {
            const TypeIcon = TYPE_META[item.type].icon;
            return (
              <div key={item.id} className={`showcase-card type-${item.type}`}>
                <div className="showcase-card-top">
                  <span className={`showcase-type-badge type-${item.type}`}>
                    <TypeIcon size={12} />
                    {TYPE_META[item.type].label}
                  </span>
                  <span className={`showcase-status status-${item.status}`}>
                    {STATUS_LABEL[item.status]}
                  </span>
                </div>
                <h3 className="showcase-card-title">{item.title}</h3>
                <p className="showcase-card-excerpt">{item.excerpt}</p>
                <div className="showcase-card-meta">
                  <span className="showcase-platform">{item.platformLabel}</span>
                  <span className="showcase-category">{item.categoryLabel}</span>
                </div>
                <div className="showcase-card-footer">
                  <span className="showcase-time">
                    <Clock size={12} />
                    {formatTime(item.createdAt)}
                  </span>
                  {item.duration && (
                    <span className="showcase-duration">{item.duration}</span>
                  )}
                  <span className="showcase-views">
                    <Eye size={12} />
                    {formatNumber(item.views)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="home-empty">
          <Sparkles size={19} />
          <p>该时段暂无生成内容</p>
          <a href="/aigc?type=video">开始创作</a>
        </div>
      )}
    </section>
  );
}
