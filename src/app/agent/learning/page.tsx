import { LearningReviewWorkbench } from "@/components/agent/LearningReviewWorkbench";

export default function LearningPage({ searchParams }: { searchParams?: { module?: string; category?: string; conversation?: string } }) {
  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">Sales Training Center</p>
          <h1>销售培训中心</h1>
          <p className="subtle">包含销售培训与模拟客户两个模块；销售培训整合产品学习和营销话术，模拟客户用于企业情报导入后的沟通演练。</p>
        </div>
      </div>
      <LearningReviewWorkbench initialQuery={searchParams} />
    </>
  );
}
