import { requireLocalMutation } from "@/server/http/local";
import { NextResponse } from "next/server";
import { PitchChannel } from "@/server/data/types";
import { submitTask } from "@/server/tasks/submit";

const channels: PitchChannel[] = ["phone", "wechat", "email", "quote_followup", "price_objection", "technical_confirm"];

export async function POST(request: Request) {
  try { requireLocalMutation(request); } catch { return NextResponse.json({error:"请求来源与本地应用不一致"},{status:403}); }
  const body = await request.json();
  if (!body.leadId || !channels.includes(body.channel)) {
    return NextResponse.json({ error: "leadId and valid channel are required" }, { status: 400 });
  }

  try { return NextResponse.json(submitTask("pitch", {leadId:body.leadId,channel:body.channel}), {status:202}); }
  catch(error) { return NextResponse.json({error:error instanceof Error?error.message:"任务提交失败"},{status:422}); }
}
