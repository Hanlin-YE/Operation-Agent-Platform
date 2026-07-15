import { NextResponse } from "next/server";
import { listProducts } from "@/server/repositories/products";

export async function GET() {
  return NextResponse.json(await listProducts());
}

export async function POST() {
  return NextResponse.json(
    { message: "产品目录已锁定，仅允许展示经产品资料审核的 Friction X 产品。" },
    { status: 403 }
  );
}
