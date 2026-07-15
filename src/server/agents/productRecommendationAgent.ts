import { Lead, Product } from "@/server/data/types";
import { getLead } from "@/server/repositories/leads";
import { listProducts } from "@/server/repositories/products";

export type ProductRecommendation = {
  product: Product;
  rationale: string;
  missingInformation: string[];
  questions: string[];
  sampleTestRecommended: boolean;
};

export async function recommendProductForLead(leadId: string): Promise<ProductRecommendation> {
  const lead = await getLead(leadId);
  if (!lead) throw new Error("Lead not found");
  const products = await listProducts();
  const corpus = `${lead.industry} ${lead.tags.join(" ")} ${lead.notes}`;
  const product = /机器人|灵巧手|医疗|无人机|云台|激光雷达/.test(corpus)
    ? products.find((item) => item.id === "fx-coreless-integrated-solution") || products[0]
    : products[0];
  return {
    product,
    rationale: `基于 ${lead.industry}、线索标签和备注，优先匹配已审核的 ${product.name}；具体规格仍需项目选型确认。`,
    missingInformation: ["目标应用部件", "尺寸/安装空间", "寿命与维护目标", "噪声/温升要求", "项目数量与节奏"],
    questions: ["当前主要应用在什么部件或设备？", "现有方案主要遇到磨损、噪声、发热还是寿命问题？", "是否有尺寸、转速、负载或维护周期限制？"],
    sampleTestRecommended: /机器人|医疗|无人机|云台|激光雷达/.test(corpus)
  };
}
