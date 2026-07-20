import { CommentAnalysis, WechatComment } from "@/server/data/types";

export type CommentInsight = { name: string; count: number };
export type CommentAnalysisResult = {
  total: number;
  valid: number;
  themes: CommentInsight[];
  sentiment: Record<"positive" | "neutral" | "negative", number>;
  risks: { type: "潜在线索" | "投诉风险" | "技术问题"; count: number }[];
  evidence: CommentAnalysis[];
};

const themeRules = [
  ["可靠性与温升", ["温升", "发热", "寿命", "稳定", "异响"]],
  ["采购与报价", ["报价", "价格", "交期", "采购", "样品", "联系我"]],
  ["技术选型", ["电机", "扭矩", "电压", "转速", "选型", "测试"]],
  ["售后与体验", ["售后", "质量", "问题", "故障", "退款", "投诉"]]
] as const;
const positiveWords = ["不错", "满意", "好", "支持", "喜欢", "感谢"];
const negativeWords = ["差", "投诉", "故障", "失望", "退款", "问题", "太高"];

export function analyzeComments(comments: Array<Pick<WechatComment, "id" | "articleId" | "content" | "createdAt" | "status">>): CommentAnalysisResult {
  const evidence = comments.filter((item) => item.status === "visible" || item.status === "selected").map((item) => {
    const themes = themeRules.filter(([, words]) => words.some((word) => item.content.includes(word))).map(([theme]) => theme);
    const sentiment: CommentAnalysis["sentiment"] = negativeWords.some((word) => item.content.includes(word)) ? "negative" : positiveWords.some((word) => item.content.includes(word)) ? "positive" : "neutral";
    const signals: CommentAnalysis["signals"] = [];
    if (["报价", "交期", "采购", "样品", "联系我"].some((word) => item.content.includes(word))) signals.push("潜在线索");
    if (["投诉", "退款", "故障", "差"].some((word) => item.content.includes(word))) signals.push("投诉风险");
    if (["温升", "寿命", "电机", "扭矩", "电压", "测试"].some((word) => item.content.includes(word))) signals.push("技术问题");
    return { commentId: item.id, themes: themes.length ? [...themes] : ["其他反馈"], sentiment, signals, generatedAt: new Date().toISOString(), model: "rules-v1" as const };
  });
  const count = <T extends string>(values: T[]) => Object.entries(values.reduce<Record<string, number>>((all, value) => ({ ...all, [value]: (all[value] || 0) + 1 }), {})).map(([name, count]) => ({ name, count }));
  const themes = count(evidence.flatMap((item) => item.themes)).sort((a, b) => b.count - a.count);
  const sentiment = evidence.reduce<Record<CommentAnalysis["sentiment"], number>>((all, item) => ({ ...all, [item.sentiment]: all[item.sentiment] + 1 }), { positive: 0, neutral: 0, negative: 0 });
  const risks = count(evidence.flatMap((item) => item.signals)).map(({ name, count }) => ({ type: name as "潜在线索" | "投诉风险" | "技术问题", count }));
  return { total: comments.length, valid: evidence.length, themes, sentiment, risks, evidence };
}
