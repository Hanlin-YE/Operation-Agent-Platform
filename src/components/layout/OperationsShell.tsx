"use client";

import {
  BarChart3,
  BookOpen,
  Bot,
  ChevronDown,
  LayoutDashboard,
  LineChart,
  Network,
  Newspaper,
  Sparkles,
  Target
} from "lucide-react";
import { usePathname } from "next/navigation";

type NavigationItem = { href: string; title: string; meta: string; icon: typeof LayoutDashboard };
type NavigationGroup = { title: string; icon: typeof LayoutDashboard; href?: string; meta?: string; items?: NavigationItem[] };

const navigationGroups: NavigationGroup[] = [
  { title: "首页", icon: LayoutDashboard, href: "/", meta: "计划、市场与生成记录" },
  {
    title: "知识资产中心", icon: BookOpen, items: [
      { href: "/knowledge", title: "产品知识", meta: "产品资料、案例与选型经验", icon: BookOpen },
      { href: "/content/library", title: "论文与专利知识库", meta: "独立 RAG 技术证据层", icon: BookOpen },
      { href: "/marketing", title: "市场知识", meta: "市场机会、竞品与策略", icon: BarChart3 },
      { href: "/marketing/xiaohongshu", title: "小红书公开线索", meta: "公开笔记与评论线索表", icon: Newspaper },
      { href: "/graph", title: "知识关系图谱", meta: "实体与关系检索", icon: Network }
    ]
  },
  { title: "AI 内容中心", icon: Sparkles, href: "/aigc?type=text", meta: "文本、图片、视频生成与内容一览" },
  {
    title: "内容运营中心", icon: Newspaper, items: [
      { href: "/content", title: "发布记录", meta: "素材与内容工作流", icon: Newspaper },
      { href: "/content/review", title: "用户数据分析", meta: "内容表现与审核反馈", icon: LineChart },
      { href: "/content/inbox", title: "内部内容排行", meta: "渠道内表现与选题复盘", icon: Target }
    ]
  },
  { title: "销售培训中心", icon: Bot, href: "/agent", meta: "产品学习、市场培训、营销话术" }
];

function isActive(pathname: string, href: string) {
  const baseHref = href.split("?")[0];
  return baseHref === "/" ? pathname === "/" : pathname === baseHref || pathname.startsWith(`${baseHref}/`);
}

function currentGroup(pathname: string) {
  return navigationGroups.find((group) => group.href ? isActive(pathname, group.href) : group.items?.some((item) => isActive(pathname, item.href))) ?? navigationGroups[0];
}

function currentItem(pathname: string, group: NavigationGroup) {
  return group.items
    ?.filter((item) => isActive(pathname, item.href))
    .sort((left, right) => right.href.split("?")[0].length - left.href.split("?")[0].length)[0];
}

export function OperationsShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const activeGroup = currentGroup(pathname);
  const active = currentItem(pathname, activeGroup) ?? activeGroup.items?.[0];
  const topbarTitle = active ? `${activeGroup.title} / ${active.title}` : activeGroup.title;

  return (
    <div className="app-shell">
      <aside className="context-sidebar">
        <a className="context-title context-brand" href="/" aria-label="返回运营首页"><span className="context-logo"><Sparkles size={16} /></span><span>Friction X · 运营自动化</span></a>
        <label className="command-search"><span>⌕</span><input aria-label="搜索工作台" placeholder="搜索知识、内容或任务" /><kbd>⌘ K</kbd></label>
        <div className="context-section nav-groups">
          <p>业务导航</p>
          {navigationGroups.map((group) => {
            const GroupIcon = group.icon;
            const groupActive = group.title === activeGroup.title;
            if (group.href) {
              return <a key={group.title} className={`nav-home-link ${groupActive ? "selected" : ""}`} href={group.href}><GroupIcon size={14} /><span><strong>{group.title}</strong><small>{group.meta}</small></span></a>;
            }
            return <details key={group.title} className="nav-group" open={groupActive}>
              <summary><GroupIcon size={14} /><strong>{group.title}</strong><ChevronDown size={14} /></summary>
              <div className="workspace-list">
                {group.items?.map((item) => {
                  const Icon = item.icon;
                  return <a key={`${item.href}-${item.title}`} className={item.href === active?.href ? "selected" : ""} href={item.href} aria-current={item.href === active?.href ? "page" : undefined}><Icon size={14} /><span><strong>{item.title}</strong><small>{item.meta}</small></span></a>;
                })}
              </div>
            </details>
          })}
        </div>
        <div className="context-status"><span className="status-dot" />知识、市场与内容引擎已连接<span>v4.1</span></div>
      </aside>

      <main className="workspace-main">
        <header className="workspace-topbar"><span>{topbarTitle}</span><div><span className="live-dot" />运营数据实时同步</div></header>
        <div className="workspace-content">{children}</div>
      </main>
    </div>
  );
}
