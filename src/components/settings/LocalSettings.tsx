'use client';
import { useEffect, useState } from 'react';
import type { ModelSettings, ModelProfile } from '@/server/models/settings';
const features = {sales:'销售话术',content:'内容生成',video:'视频分析',learning:'销售培训'} as const;
type PublicProfile = ModelProfile & {maskedKey?:string;keyConfigured?:boolean};
type PublicSettings = Omit<ModelSettings,'profiles'> & {profiles:PublicProfile[]};
export function LocalSettings() {
 const [settings,setSettings]=useState<PublicSettings | null>(null);
 const [message,setMessage]=useState('');const [busy,setBusy]=useState(false);const [dirty,setDirty]=useState(false);
 useEffect(()=>{fetch('/api/settings/models').then(async r=>{const data=await r.json();if(!r.ok)throw new Error(data.error);return data;}).then(setSettings).catch(e=>setMessage(e instanceof Error?e.message:'读取配置失败，请刷新重试'));},[]);
 function update(id:string,patch:Partial<PublicProfile>){setSettings(s=>s&&({...s,profiles:s.profiles.map(p=>p.id===id?{...p,...patch}:p)}));setDirty(true);}
 async function save(){if(!settings)return;setBusy(true);setMessage('');try{const response=await fetch('/api/settings/models',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(settings)});const data=await response.json();if(!response.ok)throw new Error(data.error);setSettings(data);setDirty(false);setMessage('模型配置已保存，后续任务使用新配置。');}catch(e){setMessage(e instanceof Error?e.message:'保存失败');}finally{setBusy(false);}}
 async function test(feature:string){setBusy(true);setMessage('正在检测连接…');try{const response=await fetch('/api/settings/models/test',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({feature})});const data=await response.json();if(!response.ok)throw new Error(data.error);setMessage(`连接正常 · ${data.model} · ${data.latencyMs}ms`);}catch(e){setMessage(e instanceof Error?e.message:'连接检测失败');}finally{setBusy(false);}}
 async function backup(){setBusy(true);try{const response=await fetch('/api/settings/backup',{method:'POST'});const data=await response.json();if(!response.ok)throw new Error(data.error);setMessage(`备份完成：${data.path}`);}catch(e){setMessage(e instanceof Error?e.message:'备份失败');}finally{setBusy(false);}}
 return <div className="local-admin"><div className="page-head"><div><h1>本地设置</h1><p className="subtle">统一管理模型、连接检测与本地数据备份。</p></div><a href="/tasks" className="button secondary">后台任务</a></div>
 <p role="status" aria-live="polite">{message}</p>
 {!settings?<p>正在读取配置…</p>:<>
 <section className="panel"><div className="page-head"><div><h2>模型服务</h2><p className="subtle">密钥保存在本机受保护文件中。留空保留已保存密钥；页面只展示末四位。</p></div><button className="button secondary" disabled={busy} onClick={()=>{const id=`model-${Date.now()}`;setSettings({...settings,profiles:[...settings.profiles,{id,name:'新模型',baseUrl:'https://api.openai.com/v1',model:'',apiKey:'',apiMode:'chat_completions',temperature:0.3,maxTokens:4096,timeoutMs:60000}]});setDirty(true);}}>添加模型</button></div>
 {settings.profiles.length===0&&<p>尚未配置模型服务。添加模型后，为下方功能选择对应模型。</p>}
 {settings.profiles.map(p=><fieldset key={p.id} className="local-model"><legend>{p.name}</legend><div className="local-form-grid">
 <label className="field">配置名称<input value={p.name} onChange={e=>update(p.id,{name:e.target.value})}/></label>
 <label className="field">模型名称<input value={p.model} placeholder="服务商提供的模型 ID" onChange={e=>update(p.id,{model:e.target.value})}/></label>
 <label className="field">服务地址<input value={p.baseUrl} onChange={e=>update(p.id,{baseUrl:e.target.value})}/></label>
 <label className="field">API 密钥（{p.maskedKey || '未配置'}）<input type="password" autoComplete="new-password" value={p.apiKey} placeholder="留空保留原密钥" onChange={e=>update(p.id,{apiKey:e.target.value})}/></label>
 <label className="field">协议<select value={p.apiMode} onChange={e=>update(p.id,{apiMode:e.target.value as ModelProfile['apiMode']})}><option value="chat_completions">Chat Completions</option><option value="responses">Responses</option></select></label>
 <label className="field">温度<input type="number" min="0" max="2" step="0.1" value={p.temperature} onChange={e=>update(p.id,{temperature:Number(e.target.value)})}/></label>
 <label className="field">最大输出 tokens<input type="number" min="1" max="65536" value={p.maxTokens} onChange={e=>update(p.id,{maxTokens:Number(e.target.value)})}/></label>
 <label className="field">超时（毫秒）<input type="number" min="1000" max="300000" step="1000" value={p.timeoutMs} onChange={e=>update(p.id,{timeoutMs:Number(e.target.value)})}/></label>
 </div><button className="button secondary" disabled={busy} onClick={()=>{setSettings({...settings,profiles:settings.profiles.filter(x=>x.id!==p.id)});setDirty(true);}}>移除此配置</button></fieldset>)}
 </section>
 <section className="panel"><h2>功能与模型</h2><p className="subtle">先保存再检测。连接检测发送一条最小请求，可能产生少量模型用量。</p>
 {Object.entries(features).map(([feature,label])=><div className="local-feature" key={feature}><label htmlFor={`model-${feature}`}>{label}</label><select id={`model-${feature}`} value={settings.features[feature as keyof typeof features]} onChange={e=>{setSettings({...settings,features:{...settings.features,[feature]:e.target.value}});setDirty(true);}}><option value="">请选择模型</option>{settings.profiles.map(p=><option key={p.id} value={p.id}>{p.name} · {p.model || '待填写'}</option>)}</select><button className="button secondary" disabled={busy||dirty} onClick={()=>test(feature)}>测试连接</button></div>)}
 <button className="button" disabled={busy} onClick={save}>{busy?'处理中…':dirty?'保存配置 *':'保存配置'}</button>
 </section></>}
 <section className="panel"><h2>数据库与附件</h2><p>本地 SQLite 保存业务数据和后台任务。视频、PDF、图片保存在本地目录，旧 JSON 会在首次读取时自动迁移并保留原文件。</p><button className="button secondary" disabled={busy} onClick={backup}>创建完整备份</button><p className="subtle">备份包含数据库及附件，模型密钥继续保留在本机。恢复时先停止应用与 worker，在项目终端执行：</p><code>npm run db:restore -- /完整/备份目录 --offline</code><p className="subtle">恢复会先创建当前数据的安全备份，再校验并恢复所选备份。</p></section>
 </div>;
}
