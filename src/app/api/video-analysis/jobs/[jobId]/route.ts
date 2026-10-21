import { NextResponse } from 'next/server';
import { taskStore } from '@/server/tasks/store';
import { videoView } from '@/server/tasks/videoView';
import { getVideoAnalysisJobsUrl, parseVideoAnalysisResult } from '@/server/videoAnalysis/service';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(_request:Request,{params}:{params:{jobId:string}}) {
 const store=taskStore();store.recover();const task=store.get(params.jobId);
 if(task) return task.kind==='video'?NextResponse.json(videoView(task)):NextResponse.json({error:'任务类型不匹配'},{status:404});
 // Read historical Agent job IDs without creating or re-executing work.
 try {const response=await fetch(getVideoAnalysisJobsUrl(params.jobId),{cache:'no-store',signal:AbortSignal.timeout(5000)}); const data=await response.json();return NextResponse.json(response.ok?parseVideoAnalysisResult(data):data,{status:response.status});}
 catch {return NextResponse.json({error:'历史视频任务服务未连接'},{status:503});}
}
