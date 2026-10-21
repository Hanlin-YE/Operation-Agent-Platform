import { BackgroundTask } from './store';
export function videoView(task: BackgroundTask) {
 if(task.status==='succeeded') return {...task.result,jobId:task.id};
 return {jobId:task.id,status:task.status==='running'?'processing':['failed','interrupted'].includes(task.status)?'failed':'queued',step:task.message || '等待队列',percent:task.progress,message:task.message || '已进入后台任务中心',source:{filename:task.payload.filename || '公开视频',sourceUrl:task.payload.sourceUrl},transcript:[],scenes:[],warnings:[],error:task.error?{code:task.status,message:task.error}:undefined};
}
