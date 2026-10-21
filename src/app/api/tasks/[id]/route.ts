import { NextResponse } from 'next/server';
import { taskStore } from '@/server/tasks/store';
export const runtime = 'nodejs'; export const dynamic = 'force-dynamic';
export async function GET(_request: Request,{params}:{params:{id:string}}) {
 const store=taskStore();store.recover();const task=store.get(params.id);
 return task ? NextResponse.json({...task,attempts:store.attempts(task.id)}) : NextResponse.json({error:'任务不存在'},{status:404});
}
