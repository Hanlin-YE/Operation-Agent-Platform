"use client";

import { useState } from "react";
import { Gauge } from "lucide-react";
import { LeadScore } from "@/server/data/types";

export function ScoreBreakdown({ leadId, initialScore, leadUpdatedAt }: { leadId: string; initialScore?: LeadScore; leadUpdatedAt?: string }) {
  const [score, setScore] = useState<LeadScore | undefined>(initialScore);
  const [loading, setLoading] = useState(false);

  async function runScore() {
    setLoading(true);
    const response = await fetch("/api/agent/score-lead", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leadId })
    });
    setScore(await response.json());
    setLoading(false);
  }

  return (
    <div className="panel">
      <div className="page-head" style={{ marginBottom: 8 }}>
        <div>
          <h2>潜客评分</h2>
          <p className="subtle">按行业、应用场景、公司和触达信息计算规则分，并给出规则生成的说明。</p>
        </div>
        <button className="button" onClick={runScore} disabled={loading}>
          <Gauge size={17} />
          {loading ? "评分中" : "规则评分"}
        </button>
      </div>

      {score && leadUpdatedAt && score.createdAt < leadUpdatedAt ? <p role="status">客户资料已更新，请重新评分。</p> : null}
      {score ? (
        <>
          <div className="badge-row">
            <span className={`badge grade-${score.grade}`}>等级 {score.grade}</span>
            <span className="badge">{score.totalScore} 分</span>
          </div>
          <div className="score-meter">
            <span style={{ width: `${score.totalScore}%` }} />
          </div>
          <div className="grid cols-2">
            <p className="subtle">行业匹配：{score.industryScore}</p>
            <p className="subtle">应用场景：{score.useCaseScore}</p>
            <p className="subtle">公司能力：{score.companyFitScore}</p>
            <p className="subtle">触达角色：{score.contactScore}</p>
            <p className="subtle">需求紧迫：{score.urgencyScore}</p>
            <p className="subtle">风险扣分：{score.riskPenalty}</p>
          </div>
          <h3 style={{ marginTop: 12 }}>判断理由</h3>
          <ul>
            {score.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
          <h3>推荐动作</h3>
          <p className="subtle">{score.recommendedAction}</p>
        </>
      ) : (
        <p className="subtle">还没有评分记录。点击 规则评分后会生成分项得分、等级和推荐动作。</p>
      )}
    </div>
  );
}
