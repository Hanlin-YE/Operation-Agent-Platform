import { NextResponse } from 'next/server';
import { taskStore } from '@/server/tasks/store';
import { submitTask } from '@/server/tasks/submit';
import { getLead } from '@/server/repositories/leads';
import { requireLocalMutation } from '@/server/http/local';
export const runtime = 'nodejs'; export const dynamic = 'force-dynamic';
export async function GET() { const store = taskStore(); store.recover(); return NextResponse.json({tasks:store.list(),workerOnline:store.online()}); }
export async function POST(request: Request) {
 try {
  requireLocalMutation(request);
  const body = await request.json();
  if (body.kind !== 'batch-score') throw new Error('此入口支持批量评分；其他任务由各业务页面提交');
  if (!Array.isArray(body.leadIds) || !body.leadIds.length || body.leadIds.length>500 || body.leadIds.some((id:unknown)=>typeof id!=='string')) throw new Error('请选择 1–500 条客户线索');
  const leadIds = [...new Set<string>(body.leadIds)].sort();
  for (const id of leadIds) if (!await getLead(id)) throw new Error(`线索不存在：${id}`);
  return NextResponse.json(submitTask('batch-score',{leadIds}),{status:202});
 } catch(error) { return NextResponse.json({error:error instanceof Error?error.message:'任务提交失败'},{status:422}); }
}
