"use client";

import {
  BookOpen,
  ChevronDown,
  LayoutDashboard,
  Sparkles,
  Target
} from "lucide-react";
import { usePathname } from "next/navigation";

type NavigationItem = { href: string; title: string; meta: string; icon: typeof LayoutDashboard };
type NavigationGroup = { title: string; icon: typeof LayoutDashboard; href?: string; meta?: string; items?: NavigationItem[] };

const navigationGroups: NavigationGroup[] = [
  { title: "今日待跟进", icon: LayoutDashboard, href: "/", meta: "今天到期、逾期和未安排任务" },
  { title: "线索管理", icon: Target, href: "/leads", meta: "线索、规则评分、话术与跟进" },
  { title: "销售知识", icon: BookOpen, href: "/knowledge", meta: "产品资料、选型经验与常见问题" },
  { title: "实验区", icon: Sparkles, href: "/experiments", meta: "已封存的内容、培训与研究模块" }
];
const experimentPrefixes = ["/content", "/aigc", "/marketing", "/graph", "/agent"];
function isExperimental(pathname: string) {
  return experimentPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function isActive(pathname: string, href: string) {
  const baseHref = href.split("?")[0];
  return baseHref === "/" ? pathname === "/" : pathname === baseHref || pathname.startsWith(`${baseHref}/`);
}

function currentGroup(pathname: string) {
  if (isExperimental(pathname)) return navigationGroups[navigationGroups.length - 1];
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
        <a className="context-title context-brand" href="/" aria-label="返回销售工作台"><span className="context-logo"><Sparkles size={16} /></span><span>Friction X · 销售工作台</span></a>
        <a className="nav-home-link" href="/leads">查找客户与联系人</a>
        <div className="context-section nav-groups">
          <p>业务导航</p>
          {navigationGroups.map((group) => {
            const GroupIcon = group.icon;
            const groupActive = group.title === activeGroup.title;
            if (group.href) {
              return <a key={group.title} className={`nav-home-link ${groupActive ? "selected" : ""}`} href={group.href} aria-current={groupActive ? "page" : undefined}><GroupIcon size={14} /><span><strong>{group.title}</strong><small>{group.meta}</small></span></a>;
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
        <div className="context-status"><span className="status-dot" />内部销售工作台<span>本地版</span></div>
      </aside>

      <main className="workspace-main">
        <header className="workspace-topbar"><span>{topbarTitle}</span><div>线索 → 评分 → 话术 → 跟进</div></header>
        <div className="workspace-content">{isExperimental(pathname) ? <aside className="experiment-notice"><strong>实验区 · 已封存</strong><p>此模块保留供查阅，不属于日常销售流程，暂不继续扩展或接入外部采集服务。</p><a href="/">返回今日待跟进</a></aside> : null}{children}</div>
      </main>
    </div>
  );
}
