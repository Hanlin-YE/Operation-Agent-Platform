import { KnowledgeDocument, Lead, Product } from "@/server/data/types";
import { listKnowledge } from "@/server/repositories/knowledge";
import { listProducts } from "@/server/repositories/products";

function tokenize(text: string) {
  return text
    .toLowerCase()
    .split(/[\s,，。；;、/|]+/)
    .filter(Boolean);
}

function scoreText(queryTokens: string[], text: string) {
  const target = text.toLowerCase();
  return queryTokens.reduce((score, token) => score + (target.includes(token) ? 1 : 0), 0);
}

export async function retrieveSalesContext(lead: Lead) {
  const [knowledge, products] = await Promise.all([listKnowledge(), listProducts()]);
  const query = `${lead.companyName} ${lead.industry} ${lead.tags.join(" ")} ${lead.notes}`;
  const tokens = tokenize(query);

  const rankedProducts = products
    .map((product) => ({
      item: product,
      score: scoreText(tokens, `${product.name} ${product.category} ${product.useCases.join(" ")} ${product.notes}`)
    }))
    .sort((a, b) => b.score - a.score);

  const rankedKnowledge = knowledge
    .map((item) => ({
      item,
      score: scoreText(tokens, `${item.title} ${item.content}`)
    }))
    .sort((a, b) => b.score - a.score);

  const selectedProducts = rankedProducts.slice(0, 2).map((entry) => entry.item);
  const selectedKnowledge = rankedKnowledge.slice(0, 3).map((entry) => entry.item);

  return {
    products: selectedProducts.length ? selectedProducts : products.slice(0, 2),
    knowledge: selectedKnowledge.length ? selectedKnowledge : knowledge.slice(0, 3)
  };
}

export function formatProduct(product: Product) {
  return `${product.name}（${product.model}）：${product.category}，功率 ${product.powerRange}，电压 ${product.voltage}，适用 ${product.useCases.join("、")}，卖点：${product.sellingPoints.join("、")}`;
}

export function formatKnowledge(item: KnowledgeDocument) {
  return `${item.title}：${item.content}`;
}
