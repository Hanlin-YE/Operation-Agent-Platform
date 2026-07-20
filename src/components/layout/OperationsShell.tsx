"use client";

import {
  BarChart3,
  BookOpen,
  Bot,
  ChevronDown,
  FileText,
  FolderOpen,
  LayoutDashboard,
  LineChart,
  MessageSquareText,
  Network,
  Newspaper,
  PenLine,
  Sparkles,
  Target,
  Users,
  Video
} from "lucide-react";
import { usePathname } from "next/navigation";

type NavigationItem = { href: string; title: string; meta: string; icon: typeof LayoutDashboard };
type NavigationGroup = { title: string; icon: typeof LayoutDashboard; href?: string; meta?: string; items?: NavigationItem[] };

const navigationGroups: NavigationGroup[] = [
  { title: "首页", icon: LayoutDashboard, href: "/", meta: "计划、市场与生成记录" },
  {
    title: "知识资产中心", icon: BookOpen, items: [
      { href: "/knowledge", title: "产品知识", meta: "产品资料、案例与选型经验", icon: BookOpen },
      { href: "/marketing", title: "市场知识", meta: "市场机会、竞品与策略", icon: BarChart3 },
      { href: "/graph", title: "知识关系图谱", meta: "实体与关系检索", icon: Network }
    ]
  },
  {
    title: "AI 内容中心", icon: Sparkles, items: [
      { href: "/aigc?type=text", title: "文本生成", meta: "选题、文案与脚本", icon: FileText },
      { href: "/aigc?type=image", title: "图片生成", meta: "视觉资产与风格首帧", icon: Sparkles },
      { href: "/aigc?type=video", title: "视频生成", meta: "分镜与视频任务", icon: Video },
      { href: "/aigc", title: "内容一览", meta: "创作任务与生成记录", icon: FolderOpen }
    ]
  },
  {
    title: "内容运营中心", icon: Newspaper, items: [
      { href: "/content", title: "发布记录", meta: "素材与内容工作流", icon: Newspaper },
      { href: "/content/review", title: "用户数据分析", meta: "内容表现与审核反馈", icon: LineChart },
      { href: "/content/inbox", title: "热门内容", meta: "市场素材与热点输入", icon: Target }
    ]
  },
  {
    title: "销售培训中心", icon: Bot, items: [
      { href: "/agent", title: "产品学习", meta: "产品知识与销售流程", icon: BookOpen },
      { href: "/marketing/strategy", title: "市场培训", meta: "市场判断与行动策略", icon: BarChart3 },
      { href: "/leads", title: "客户问题", meta: "客户画像与异议记录", icon: MessageSquareText },
      { href: "/agent", title: "营销话术", meta: "专业沟通与话术生成", icon: PenLine },
      { href: "/agent/learning", title: "学习记录", meta: "历史对话与知识复习", icon: MessageSquareText },
      { href: "/agent/runs", title: "销售复盘", meta: "任务执行与人工审核", icon: Users }
    ]
  }
];

function isActive(pathname: string, href: string) {
  const baseHref = href.split("?")[0];
  return baseHref === "/" ? pathname === "/" : pathname === baseHref || pathname.startsWith(`${baseHref}/`);
}

function currentGroup(pathname: string) {
  return navigationGroups.find((group) => group.href ? isActive(pathname, group.href) : group.items?.some((item) => isActive(pathname, item.href))) ?? navigationGroups[0];
}

export function OperationsShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const activeGroup = currentGroup(pathname);
  const active = activeGroup.items?.find((item) => isActive(pathname, item.href)) ?? activeGroup.items?.[0];
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
                  return <a key={`${item.href}-${item.title}`} className={isActive(pathname, item.href) ? "selected" : ""} href={item.href}><Icon size={14} /><span><strong>{item.title}</strong><small>{item.meta}</small></span></a>;
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
