import { NextResponse } from 'next/server';
import { taskStore } from '@/server/tasks/store';
import { featureFor } from '@/server/tasks/submit';
import { modelSnapshot, safeModelError } from '@/server/models/settings';
import { requireLocalMutation } from '@/server/http/local';
export const runtime = 'nodejs';
export async function POST(request: Request,{params}:{params:{id:string}}) {
 try {
  requireLocalMutation(request);const store=taskStore();store.recover();const task=store.get(params.id);
  if(!task)return NextResponse.json({error:'任务不存在'},{status:404});
  const feature=featureFor(task.kind);return NextResponse.json(store.retry(task.id,feature?modelSnapshot(feature):null),{status:202});
 } catch(error) { return NextResponse.json({error:safeModelError(error)},{status:409}); }
}
