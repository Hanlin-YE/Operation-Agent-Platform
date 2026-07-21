import { ContentAnalyticsWorkbench } from "@/components/content/ContentAnalyticsWorkbench";
import { getWechatCommentDashboard } from "@/server/repositories/wechatComments";
import { WechatCommentsWorkbench } from "@/components/content/WechatCommentsWorkbench";

export default async function ContentReviewPage() {
  const dashboard = await getWechatCommentDashboard();
  return <><ContentAnalyticsWorkbench /><div className="page-head"><div><p className="eyebrow">User Data / Wechat Comments</p><h1>用户数据分析</h1><p className="subtle">公众号评论的主题、情绪、痛点和风险信号；所有结论可回溯到原始评论，线索与投诉只进入人工审核。</p></div></div><WechatCommentsWorkbench initial={dashboard} /></>;
}
