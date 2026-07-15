import { NextResponse } from "next/server";
import { createKnowledge, listKnowledge } from "@/server/repositories/knowledge";

export async function GET() {
  return NextResponse.json(await listKnowledge());
}

export async function POST(request: Request) {
  const body = await request.json();
  const item = await createKnowledge(body);
  return NextResponse.json(item, { status: 201 });
}
