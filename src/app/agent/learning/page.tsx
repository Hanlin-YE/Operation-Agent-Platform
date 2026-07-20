import { LearningReviewWorkbench } from "@/components/agent/LearningReviewWorkbench";

export default function LearningPage() {
  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">Sales Training Center</p>
          <h1>销售培训中心</h1>
          <p className="subtle">围绕产品学习、市场培训和营销话术沉淀学习记录；后续可分别接入对应知识库。</p>
        </div>
      </div>
      <LearningReviewWorkbench />
    </>
  );
}
