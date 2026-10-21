import { requireLocalMutation } from "@/server/http/local";
import { NextResponse } from 'next/server';
import { validateVideoSourceUrl } from '@/server/videoAnalysis/service';
import { submitTask } from '@/server/tasks/submit';
import { videoView } from '@/server/tasks/videoView';
import { saveAttachment } from '@/server/storage/attachments';
import { modelSnapshot } from '@/server/models/settings';
export const runtime='nodejs';
export async function POST(request: Request) {
 try {
  requireLocalMutation(request);
  modelSnapshot('video');
  const form=await request.formData();const file=form.get('video');let sourceUrl=String(form.get('sourceUrl') || '').trim();
  if ((file instanceof File) === Boolean(sourceUrl)) throw new Error('请选择一个视频文件或提供一个公开视频链接');
  if(sourceUrl) sourceUrl=validateVideoSourceUrl(sourceUrl);
  let payload: Record<string,string>={sourceUrl};
  if(file instanceof File) {
   if (!file.type.startsWith('video/') || !/\.(mp4|mov|webm)$/i.test(file.name) || !file.size || file.size>300*1024*1024) throw new Error('视频需为 300MB 以内的 MP4、MOV 或 WebM');
   payload={attachment:await saveAttachment(new Uint8Array(await file.arrayBuffer()),file.name.split('.').pop()!.toLowerCase()),filename:file.name,mimeType:file.type};
  }
  const task=submitTask('video',payload);
  return NextResponse.json(videoView(task),{status:202});
 } catch(error) {return NextResponse.json({error:error instanceof Error?error.message:'视频任务创建失败'},{status:422});}
}
