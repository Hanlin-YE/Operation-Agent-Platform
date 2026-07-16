"use client";

import {
  BookOpen,
  BarChart3,
  Bot,
  CircleHelp,
  Clapperboard,
  Command,
  FileSearch,
  Files,
  LayoutDashboard,
  Network,
  Newspaper,
  Settings2,
  Sparkles,
  Target,
  UploadCloud,
  Users,
  Workflow
} from "lucide-react";
import { usePathname } from "next/navigation";

type NavigationItem = { href: string; title: string; meta: string; icon: typeof LayoutDashboard };

const acquisitionNavigation: NavigationItem[] = [
  { href: "/", title: "工作总览", meta: "今日转化优先级", icon: LayoutDashboard },
  { href: "/leads", title: "线索与账户", meta: "客户分层与跟进", icon: Users },
  { href: "/agent", title: "销售智能体", meta: "推荐、话术与客服", icon: Bot },
  { href: "/agent/runs", title: "运营任务", meta: "采集与人工审核", icon: Workflow },
  { href: "/graph", title: "关系图谱", meta: "Neo4j 实体与关系", icon: Network },
  { href: "/knowledge", title: "销售知识", meta: "产品与销售资料", icon: BookOpen }
];

const contentNavigation: NavigationItem[] = [
  { href: "/content", title: "内容总览", meta: "素材到知识的工作流", icon: LayoutDashboard },
  { href: "/content/inbox", title: "素材输入", meta: "会议、活动与多媒体", icon: UploadCloud },
  { href: "/content/library", title: "论文与专利 RAG", meta: "来源、切片与证据", icon: Files },
  { href: "/content/review", title: "证据审核", meta: "引用与发布前确认", icon: FileSearch }
];

const aigcNavigation: NavigationItem[] = [
  { href: "/aigc", title: "AIGC 创作", meta: "任务编排与平台适配", icon: Clapperboard }
];

const marketingNavigation: NavigationItem[] = [
  { href: "/marketing", title: "市场分析", meta: "机会、竞品与进入策略", icon: BarChart3 }
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

export function OperationsShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isContentWorkspace = pathname === "/content" || pathname.startsWith("/content/");
  const isAigcWorkspace = pathname === "/aigc" || pathname.startsWith("/aigc/");
  const isMarketingWorkspace = pathname === "/marketing" || pathname.startsWith("/marketing/");
  const navigation = isAigcWorkspace ? aigcNavigation : isMarketingWorkspace ? marketingNavigation : isContentWorkspace ? contentNavigation : acquisitionNavigation;
  const active = navigation.find((item) => isActive(pathname, item.href)) ?? navigation[0];
  const ActiveIcon = active.icon;
  const workspaceName = isAigcWorkspace ? "AIGC 创作 Agent" : isMarketingWorkspace ? "市场营销 Agent" : isContentWorkspace ? "内容运营 Agent" : "获客 Agent";

  return (
    <div className="app-shell">
      <aside className="app-rail platform-rail" aria-label="平台工作台">
        <a className="app-logo" href="/" aria-label="Friction X Agent 平台"><Sparkles size={20} /></a>
        <p className="rail-caption">工作台</p>
        <nav className="platform-switcher">
          <a className={!isContentWorkspace && !isMarketingWorkspace && !isAigcWorkspace ? "active" : ""} href="/" aria-label="切换到获客 Agent" title="获客 Agent"><Target size={19} /><span>获客</span></a>
          <a className={isContentWorkspace ? "active" : ""} href="/content" aria-label="切换到内容运营 Agent" title="内容运营 Agent"><Newspaper size={19} /><span>内容</span></a>
          <a className={isMarketingWorkspace ? "active" : ""} href="/marketing" aria-label="切换到市场营销 Agent" title="市场营销 Agent"><BarChart3 size={19} /><span>市场</span></a>
          <a className={isAigcWorkspace ? "active" : ""} href="/aigc" aria-label="切换到 AIGC 创作 Agent" title="AIGC 创作 Agent"><Clapperboard size={19} /><span>AIGC</span></a>
        </nav>
        <div className="rail-bottom">
          <a href={isContentWorkspace ? "/content" : isMarketingWorkspace ? "/marketing" : isAigcWorkspace ? "/aigc" : "/agent"} aria-label="帮助" title="帮助"><CircleHelp size={18} /></a>
          <a href={isContentWorkspace ? "/content" : isMarketingWorkspace ? "/marketing" : isAigcWorkspace ? "/aigc" : "/agent"} aria-label="设置" title="设置"><Settings2 size={18} /></a>
        </div>
      </aside>

      <aside className="context-sidebar">
        <div className="context-title"><Command size={16} /><span>Friction X · {workspaceName}</span></div>
        <label className="command-search"><span>⌕</span><input aria-label="搜索工作台" placeholder={isAigcWorkspace ? "搜索创作任务或生成资产" : isMarketingWorkspace ? "搜索市场、竞品或客户假设" : isContentWorkspace ? "搜索素材、论文或专利" : "搜索线索、任务或图谱"} /><kbd>⌘ K</kbd></label>
        <div className="context-section">
          <p>当前模块</p>
          <a className="pinned-workspace" href={active.href}><ActiveIcon size={14} /><span><strong>{active.title}</strong><small>{active.meta}</small></span></a>
        </div>
        <div className="context-section workspace-list">
          <p>{isAigcWorkspace ? "AIGC 创作模块" : isMarketingWorkspace ? "市场营销模块" : isContentWorkspace ? "内容运营模块" : "获客运营模块"}</p>
          {navigation.map((item) => {
            const Icon = item.icon;
            return <a key={item.href} className={isActive(pathname, item.href) ? "selected" : ""} href={item.href}><Icon size={14} /><span><strong>{item.title}</strong><small>{item.meta}</small></span></a>;
          })}
        </div>
        <div className="context-status"><span className="status-dot" />{isAigcWorkspace ? "AIGC 执行层已连接" : isMarketingWorkspace ? "企业知识与市场假设已连接" : isContentWorkspace ? "内容知识层已连接" : "获客控制面已连接"}<span>v4.0</span></div>
      </aside>

      <main className="workspace-main">
        <header className="workspace-topbar"><span>{workspaceName} / {active.title}</span><div><span className="live-dot" />运营数据实时同步</div></header>
        <div className="workspace-content">{children}</div>
      </main>
    </div>
  );
}
