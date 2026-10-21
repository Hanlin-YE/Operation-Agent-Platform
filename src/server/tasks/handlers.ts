import { createHmac } from "node:crypto";
import { BackgroundTask, TaskStore } from './store';
import { runLeadScoringAgent } from '../agents/leadScoringAgent';
import { runPitchGenerationAgent } from '../agents/pitchGenerationAgent';
import { analyzeContentStrategy, requestContentStrategyRework, retryContentStrategyRework } from '../contentStrategy/service';
import { getContentStrategy, getContentStrategyVersions } from '../repositories/contentStrategies';
import { readAttachment } from '../storage/attachments';
import { modelContext, modelRequest, resolveModel } from '../models/settings';
import { getVideoAnalysisJobsUrl } from '../videoAnalysis/service';
import { setTimeout as delay } from 'node:timers/promises';

async function video(task: BackgroundTask, store: TaskStore, owner: string) {
 let checkpoint = store.checkpoint(task.id) as { key:string;jobId?:string } | null;
 if(checkpoint?.jobId) {
  const previous = await fetch(getVideoAnalysisJobsUrl(checkpoint.jobId),{signal:AbortSignal.timeout(10000)});
  if(!previous.ok) throw new Error("读取原视频任务失败，保留原任务引用，连接恢复后可重试");
  const job=await previous.json();
  if(job.model)store.recordModel(task.id,owner,job.model);
  if(job.status==='needs_review')return job;
  if(['failed','interrupted','model_not_configured'].includes(job.status))checkpoint=null;
 }
 if(!checkpoint) {checkpoint={key:`${task.id}:${task.attempt}`};store.checkpoint(task.id,checkpoint);}
 if(!checkpoint.jobId) {
  const profile=resolveModel('video',task.model);
  await modelRequest(profile,[{role:'user',content:'Reply OK'}],false,true);
  if(task.model)store.recordModel(task.id,owner,task.model);
  const form = new FormData();
  if (task.payload.attachment) {
   const bytes = await readAttachment(task.payload.attachment);
   form.set('video',new Blob([new Uint8Array(bytes)],{type:task.payload.mimeType}),task.payload.filename);
  } else form.set('source_url',task.payload.sourceUrl);
  const serializedModel=JSON.stringify(task.model);
  form.set('model_snapshot',serializedModel);
  const response = await fetch(getVideoAnalysisJobsUrl(),{method:'POST',body:form,headers:{'Idempotency-Key':checkpoint.key,'X-Local-Model-Signature':createHmac('sha256',profile.apiKey).update(serializedModel).digest('hex')},signal:AbortSignal.timeout(20000)});
  const created = await response.json();
  if (!response.ok) throw new Error(String(created.detail || created.error || `视频服务 HTTP ${response.status}`));
  if (!created.jobId) throw new Error('视频服务未返回任务编号');
  checkpoint.jobId=created.jobId;store.checkpoint(task.id,checkpoint);
 }
 const jobId = checkpoint.jobId!;
 const deadline=Date.now()+2*60*60*1000;
 for (;;) {
  if(Date.now()>deadline)throw new Error("视频处理超过两小时，任务引用已保留，重试将先查询原任务");
  const response = await fetch(getVideoAnalysisJobsUrl(jobId),{signal:AbortSignal.timeout(10000),cache:'no-store'});
  const job = await response.json();
  if (!response.ok) throw new Error(String(job.detail || `视频服务 HTTP ${response.status}`));
  if (job.status === 'needs_review') return job;
  if (['failed','interrupted','model_not_configured'].includes(job.status)) throw new Error(job.error?.message || job.message || '视频分析失败');
  if (!store.progress(task.id,owner,Number(job.percent)||0,String(job.message || '视频处理中'))) throw new Error('任务执行权已失效');
  await delay(2000);
 }
}
export async function executeTask(task: BackgroundTask, store: TaskStore, owner: string) {
 const run = async () => {
  const payload = task.payload;
  switch(task.kind) {
   case 'batch-score': {
    const results = [];
    for (let i=0;i<payload.leadIds.length;i++) {
     results.push(await runLeadScoringAgent(payload.leadIds[i], `${task.id}:${payload.leadIds[i]}`));
     if (!store.progress(task.id,owner,Math.round((i+1)/payload.leadIds.length*99),`已评分 ${i+1}/${payload.leadIds.length}`)) throw new Error('任务执行权已失效');
    }
    return results;
   }
   case 'pitch': return runPitchGenerationAgent(payload.leadId,payload.channel);
   case 'content-strategy': {
    const imageData = await Promise.all((payload.imagePaths || []).map(async (image:any)=>({mimeType:image.mimeType,dataUrl:`data:${image.mimeType};base64,${(await readAttachment(image.path)).toString('base64')}`})));
    const result = await analyzeContentStrategy({...payload,imageData});
    if (result.status === 'error' || result.status === 'model_not_configured') throw new Error(result.error || '内容模型尚未配置');
    return result;
   }
   case 'content-rework': {
    let item = await getContentStrategy(payload.id); if (!item) throw new Error('策略包不存在');
    const versions = await getContentStrategyVersions(item.id);
    const existing = versions.find(version=>version.backgroundTaskId===task.id);
    if(existing?.status==='needs_review')return existing;
    if(existing)item=existing;
    const result = ['rework_pending','rework_failed','rework_processing'].includes(item.status) ? await retryContentStrategyRework(item,versions.at(-2)?.analysis) : await requestContentStrategyRework(item,payload,task.id);
    if (['rework_failed','rework_pending'].includes(result.status)) throw new Error(result.error || '返修失败');
    return result;
   }
   case 'video': return video(task,store,owner);
  }
 };
 return task.model ? modelContext.run(resolveModel(task.kind==='pitch'?'sales':task.kind==='video'?'video':'content',task.model),run) : run();
}
