'use client';
import { useEffect,useState } from 'react';
import type { BackgroundTask } from '@/server/tasks/store';
const statuses={queued:'等待执行',running:'执行中',succeeded:'已完成',failed:'失败',interrupted:'已中断'};
const kinds={'batch-score':'批量线索评分',pitch:'销售话术','content-strategy':'内容策略生成','content-rework':'内容返修',video:'视频分析'};
export function TaskCenter(){
 const [tasks,setTasks]=useState<BackgroundTask[]>([]);const [online,setOnline]=useState(false);const [error,setError]=useState('');const [busy,setBusy]=useState('');const [loaded,setLoaded]=useState(false);
 async function refresh(){const response=await fetch('/api/tasks',{cache:'no-store'});const data=await response.json();if(!response.ok)throw new Error(data.error || '任务读取失败');setTasks(data.tasks);setOnline(data.workerOnline);setLoaded(true);}
 useEffect(()=>{let active=true;const poll=async()=>{try{if(active)await refresh();}catch(e){if(active)setError(e instanceof Error?e.message:'读取失败');}};void poll();const timer=setInterval(poll,3000);return()=>{active=false;clearInterval(timer);};},[]);
 async function retry(id:string){setBusy(id);setError('');try{const response=await fetch(`/api/tasks/${id}/retry`,{method:'POST'});const data=await response.json();if(!response.ok)throw new Error(data.error);await refresh();}catch(e){setError(e instanceof Error?e.message:'重试失败');}finally{setBusy('');}}
 async function scoreAll(){setBusy('all');setError('');try{const response=await fetch('/api/leads');const data=await response.json();if(!response.ok)throw new Error('读取线索失败');const leads=Array.isArray(data)?data:data.leads;const submitted=await fetch('/api/tasks',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind:'batch-score',leadIds:leads.map((l:{id:string})=>l.id)})});const result=await submitted.json();if(!submitted.ok)throw new Error(result.error);await refresh();}catch(e){setError(e instanceof Error?e.message:'提交失败');}finally{setBusy('');}}
 return <div className="local-admin"><div className="page-head"><div><h1>后台任务</h1><p className="subtle">关闭页面后继续执行，重新打开后查看进度和结果。</p></div><a className="button secondary" href="/settings">模型与本地设置</a></div>
 {error&&<p role="alert" className="run-error">{error}</p>}
 <section className="panel"><div className="page-head"><div><h2>{!loaded?'读取任务状态…':online?'后台执行器在线':'后台执行器离线'}</h2><p className="subtle">{online?'相同输入会复用已有任务；失败或中断后可重试。':'请通过 npm run dev / npm start 启动应用，或在项目终端运行 npm run worker。记录会继续保留。'}</p></div><button className="button" disabled={!!busy} onClick={scoreAll}>批量评分全部线索</button></div><p className="subtle">评分使用本地规则，不消耗模型额度。重试使用当前配置；中断的远端请求可能已经产生费用，重试可能再次计费。</p></section>
 {loaded&&!tasks.length&&<section className="panel"><h2>暂无后台任务</h2><p>从视频分析、销售话术或批量评分入口提交，记录会显示在这里。</p></section>}
 {tasks.map(task=><article className="panel" key={task.id}><div className="page-head"><div><h2>{kinds[task.kind]}</h2><p className="subtle">{new Date(task.createdAt).toLocaleString()} · 第 {task.attempt} 次执行 · {task.model?`${task.model.name} / ${task.model.model}`:'本地规则 rules-v1'}</p></div><span className="badge">{statuses[task.status]}</span></div>
 <progress max="100" value={task.progress} aria-label={`${kinds[task.kind]}进度`}/><p>{task.progress}% · {task.message || statuses[task.status]}</p>
 {task.error&&<p className="run-error">{task.error}</p>}
 {['failed','interrupted'].includes(task.status)&&<button className="button" disabled={!!busy} onClick={()=>retry(task.id)}>{busy===task.id?'正在提交…':'重试任务'}</button>}
 {task.status==='succeeded'&&task.kind==='video'&&<a href={`/aigc?type=strategy&videoJobId=${task.id}`} className="button secondary">打开视频分析结果</a>}
 {task.result!=null&&<details><summary>查看结果</summary><pre className="task-result">{typeof task.result==='string'?task.result:JSON.stringify(task.result,null,2)}</pre></details>}
 <details><summary>任务信息与执行记录</summary><TaskHistory id={task.id} attempt={task.attempt} status={task.status}/></details>
 </article>)}
 </div>;
}
function TaskHistory({id,attempt,status}:{id:string;attempt:number;status:string}){const [data,setData]=useState<unknown>(null);useEffect(()=>{fetch(`/api/tasks/${id}`).then(r=>r.json()).then(task=>setData({id:task.id,model:task.model,attempts:task.attempts})).catch(()=>setData('执行记录暂时无法读取'));},[id,attempt,status]);return <pre className="task-result">{JSON.stringify(data,null,2)}</pre>;}
