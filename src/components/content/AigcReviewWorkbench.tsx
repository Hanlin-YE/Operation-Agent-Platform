"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, CircleAlert, ClipboardCheck, FileSearch, RefreshCw, Sparkles } from "lucide-react";
import type { AigcReviewReport } from "@/server/aigc/types";

type ReviewsPayload = {
  reviews?: AigcReviewReport[];
  error?: string;
};

async function readJson(response: Response) {
  const body = await response.text();
  try {
    return JSON.parse(body) as ReviewsPayload;
  } catch {
    return { error: "服务返回了无法识别的数据。" };
  }
}

function compact(value: string, max = 58) {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > max ? `${normalized.slice(0, max)}...` : normalized;
}

function scoreClass(score: number) {
  if (score >= 85) return "grade-A";
  if (score >= 72) return "grade-B";
  if (score >= 60) return "grade-C";
  return "grade-D";
}

export function AigcReviewWorkbench() {
  const [reviews, setReviews] = useState<AigcReviewReport[]>([]);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadReviews = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/aigc/reviews", { cache: "no-store" });
      const payload = await readJson(response);
      if (!response.ok || !Array.isArray(payload.reviews)) throw new Error(payload.error || "读取审核评测失败");
      setReviews(payload.reviews);
      setActiveJobId((current) => current || payload.reviews?.[0]?.jobId || null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "读取审核评测失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReviews();
  }, [loadReviews]);

  const activeReview = useMemo(() => reviews.find((review) => review.jobId === activeJobId) || reviews[0] || null, [activeJobId, reviews]);

  return (
    <section className="aigc-review-workbench" aria-label="审核评测">
      <section className="panel aigc-review-intro">
        <ClipboardCheck size={20} />
        <div>
          <p className="eyebrow">Review Evaluation</p>
          <h2>审核评测</h2>
          <p className="subtle">根据前序输入、脚本分镜和生产约束判断内容是否具备爆款文案潜力；每条反馈都回扣原始输入与镜头证据。</p>
        </div>
        <button className="icon-button" type="button" onClick={loadReviews} aria-label="刷新审核评测" disabled={loading}><RefreshCw size={16} /></button>
      </section>

      {error ? <p className="run-error"><CircleAlert size={16} />{error}</p> : null}

      {reviews.length && activeReview ? (
        <div className="aigc-review-grid">
          <aside className="panel aigc-review-list">
            <div className="rag-section-head"><div><p className="eyebrow">Input Records</p><h2>待评测脚本</h2></div><span className="badge">{reviews.length} 条</span></div>
            <div className="aigc-review-job-list">
              {reviews.map((review) => <button key={review.jobId} className={review.jobId === activeReview.jobId ? "active" : ""} type="button" onClick={() => setActiveJobId(review.jobId)}><strong>{review.projectTitle}</strong><span>{compact(review.matchedInputs[0] || review.verdict)}</span><small>{new Date(review.updatedAt).toLocaleString("zh-CN")}</small></button>)}
            </div>
          </aside>

          <section className="panel aigc-review-detail">
            <div className="aigc-review-scorebar">
              <div>
                <p className="eyebrow">Viral Copy Potential</p>
                <h2>{activeReview.verdict}</h2>
                <p className="subtle">评测对象：{compact(activeReview.projectTitle, 72)}。系统已读取提交时保存的真实输入、脚本分镜、资产提示和平台产物。</p>
              </div>
              <strong className={`aigc-review-score ${activeReview.level}`}>{activeReview.score}<span>分</span></strong>
            </div>

            <div className="aigc-review-input-match">
              <div className="rag-section-head"><div><p className="eyebrow">Matched Inputs</p><h2>输入映射证据</h2></div><FileSearch size={18} /></div>
              {activeReview.matchedInputs.map((item) => <p key={item}>{item}</p>)}
              {!activeReview.planCaptured ? <p>该任务为旧任务记录，未保存完整创作封装；评测已基于现有请求和执行载荷降级生成。</p> : null}
            </div>

            <div className="aigc-review-dimensions">
              {activeReview.dimensions.map((item) => <article key={item.id} className="aigc-review-dimension">
                <div className="aigc-review-dimension-head">
                  <div><strong>{item.label}</strong><span>{item.verdict}</span></div>
                  <span className={`badge ${scoreClass(item.score)}`}>{item.score} 分</span>
                </div>
                <blockquote>{item.evidence}</blockquote>
                <p>{item.feedback}</p>
                <small>{item.revisionAction}</small>
              </article>)}
            </div>

            <div className="aigc-review-stage-grid" aria-label="AIGC 阶段评测">
              {activeReview.stageSignals.map((item) => <article key={item.stage} className="aigc-review-stage-card">
                <div><strong>{item.label}</strong><span className={`badge ${scoreClass(item.score)}`}>{item.score} 分</span></div>
                <blockquote>{item.evidence}</blockquote>
                <p>{item.feedback}</p>
              </article>)}
            </div>

            <div className="aigc-review-actions">
              <div className="rag-section-head"><div><p className="eyebrow">Revision Actions</p><h2>针对输入的修改意见</h2></div><Sparkles size={18} /></div>
              {activeReview.revisionActions.map((item) => <p key={item}><CheckCircle2 size={14} />{item}</p>)}
            </div>
          </section>
        </div>
      ) : (
        <section className="panel aigc-review-empty">
          <FileSearch size={24} />
          <div>
            <h2>{loading ? "正在检查提交记录" : "等待提交执行任务"}</h2>
            <p className="subtle">审核评测不会预先生成。只有在“文本生成”完成创作封装、审批资产并点击“提交内容任务”后，这里才会读取该任务的真实输入、脚本分镜和执行约束生成评分。</p>
          </div>
          <a className="button secondary" href="/aigc?type=text">进入文本生成</a>
        </section>
      )}
    </section>
  );
}
