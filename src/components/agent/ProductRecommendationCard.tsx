"use client";

import { useState } from "react";
import { Lightbulb } from "lucide-react";

type Recommendation = { product: { name: string; category: string }; rationale: string; missingInformation: string[]; questions: string[]; sampleTestRecommended: boolean };

export function ProductRecommendationCard({ leadId }: { leadId: string }) {
  const [result, setResult] = useState<Recommendation>();
  const [loading, setLoading] = useState(false);
  async function recommend() {
    setLoading(true);
    const response = await fetch("/api/agent/recommend-product", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ leadId }) });
    setResult(await response.json()); setLoading(false);
  }
  return <div className="panel"><h2>产品应用推荐</h2><button className="button" onClick={recommend} disabled={loading}><Lightbulb size={17} />{loading ? "匹配中" : "生成推荐"}</button>{result && <div style={{ marginTop: 14 }}><strong>{result.product.name}</strong><p className="subtle">{result.rationale}</p><p><strong>缺失信息：</strong>{result.missingInformation.join("、")}</p><p><strong>建议问诊：</strong>{result.questions.join(" ")}</p>{result.sampleTestRecommended && <span className="badge grade-B">建议样品/联合验证</span>}</div>}</div>;
}
