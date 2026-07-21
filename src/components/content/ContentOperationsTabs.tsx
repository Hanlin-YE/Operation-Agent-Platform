import { BarChart3, ListVideo, PlayCircle, TrendingUp } from "lucide-react";

type ContentRoute = "records" | "analytics" | "highlights" | "player";

const routes = [
  { key: "records" as const, href: "/content", label: "发布记录", icon: ListVideo },
  { key: "analytics" as const, href: "/content/review", label: "用户数据分析", icon: BarChart3 },
  { key: "highlights" as const, href: "/content/inbox", label: "内部内容排行", icon: TrendingUp },
  { key: "player" as const, href: "/content/player", label: "观看反馈", icon: PlayCircle }
];

export function ContentOperationsTabs({ current }: { current: ContentRoute }) {
  return (
    <nav className="content-mobile-tabs" aria-label="内容运营中心页面">
      {routes.map((route) => {
        const Icon = route.icon;
        return (
          <a key={route.key} href={route.href} className={route.key === current ? "active" : ""} aria-current={route.key === current ? "page" : undefined}>
            <Icon size={15} />
            <span>{route.label}</span>
          </a>
        );
      })}
    </nav>
  );
}
