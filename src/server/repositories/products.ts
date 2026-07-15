import { Product } from "@/server/data/types";
import { frictionXCatalog, getFrictionXCatalogProduct } from "@/server/data/frictionxCatalog";

export type ProductInput = Omit<Product, "id" | "createdAt" | "updatedAt">;

export async function listProducts() {
  return frictionXCatalog;
}

export async function getProduct(id: string) {
  return getFrictionXCatalogProduct(id);
}

export async function createProduct(_input: Partial<ProductInput>) {
  throw new Error("产品目录仅允许由已审核的 Friction X 产品资料维护");
}
