import { existsSync, readFileSync, mkdirSync, writeFileSync, renameSync, chmodSync } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { AsyncLocalStorage } from 'node:async_hooks';
import { dataDirectory } from '../storage/database';
export const modelFeatures = ['sales', 'content', 'video', 'learning'] as const;
export type ModelFeature = typeof modelFeatures[number];
export type ModelProfile = { id: string; name: string; baseUrl: string; model: string; apiKey: string; temperature: number; maxTokens: number; timeoutMs: number; apiMode: 'chat_completions' | 'responses' };
export type ModelSnapshot = Omit<ModelProfile,'apiKey'>;
export type ModelSettings = { version: 1; profiles: ModelProfile[]; features: Record<ModelFeature,string> };
export const modelContext = new AsyncLocalStorage<ModelProfile>();
const settingsPath = () => path.join(dataDirectory(), 'model-settings.json');
function legacySettings(): ModelSettings {
 const profiles: ModelProfile[] = [];
 const add = (id: string, apiKey: string | undefined, baseUrl: string, model: string, apiMode: ModelProfile['apiMode'] = 'chat_completions') => {
  if (apiKey?.trim()) profiles.push({id,name:id,apiKey:apiKey.trim(),baseUrl,model,apiMode,temperature:0.3,maxTokens:4096,timeoutMs:60000});
 };
 add('default',process.env.OPENAI_API_KEY || process.env.LLM_API_KEY,process.env.OPENAI_BASE_URL || process.env.LLM_BASE_URL || 'https://api.openai.com/v1',process.env.OPENAI_MODEL || process.env.LLM_MODEL || 'gpt-4o-mini',process.env.LLM_API_MODE === 'responses' ? 'responses' : 'chat_completions');
 add('deepseek',process.env.DEEPSEEK_API_KEY,'https://api.deepseek.com',process.env.DEEPSEEK_MODEL || 'deepseek-chat');
 const primary=profiles.find(p=>p.id==='default')?.id || profiles[0]?.id || '';
 return {version:1,profiles,features:{sales:primary,content:primary,video:primary,learning:profiles.some(p=>p.id==='deepseek')?'deepseek':primary}};
}
export function readSettings(): ModelSettings {
 if (!existsSync(settingsPath())) return legacySettings();
 try {
  const data=JSON.parse(readFileSync(settingsPath(),'utf8'));
  if(data.version!==1 || !Array.isArray(data.profiles) || !data.features)throw new Error('invalid');
  return data;
 } catch {throw new Error('本地模型配置文件格式无效，请修复 data/model-settings.json 或从安全副本恢复。');}
}
export function publicSettings() {
 const settings = readSettings();
 return {...settings,profiles:settings.profiles.map(({apiKey,...p})=>({...p,apiKey:'',keyConfigured:Boolean(apiKey),maskedKey:apiKey ? (apiKey.length>8?`••••${apiKey.slice(-4)}`:'已配置') : '未配置'}))};
}
export function saveSettings(input: ModelSettings) {
 if (input.version !== 1 || !Array.isArray(input.profiles) || input.profiles.length > 30) throw new Error('模型设置格式无效');
 const previous = readSettings();
 const ids = new Set<string>();
 const profiles = input.profiles.map(p=> {
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(p.id) || ids.has(p.id)) throw new Error('模型配置 ID 无效或重复');
  ids.add(p.id);
  const url = new URL(p.baseUrl);
  if (!['https:','http:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error('服务地址需为 HTTP(S) 地址，密钥请填入独立字段');
  if (!p.model?.trim() || !p.name?.trim()) throw new Error('请填写配置名称和模型名称');
  if (!['chat_completions','responses'].includes(p.apiMode)) throw new Error('模型协议无效');
  if (!Number.isFinite(p.temperature) || p.temperature<0 || p.temperature>2 || !Number.isInteger(p.maxTokens) || p.maxTokens<1 || p.maxTokens>65536 || !Number.isInteger(p.timeoutMs) || p.timeoutMs<1000 || p.timeoutMs>300000) throw new Error('参数范围：温度 0–2、输出 1–65536 tokens、超时 1000–300000ms');
  return {id:p.id,name:p.name.trim(),baseUrl:p.baseUrl.trim().replace(/\/$/,''),model:p.model.trim(),apiMode:p.apiMode,temperature:p.temperature,maxTokens:p.maxTokens,timeoutMs:p.timeoutMs,apiKey:p.apiKey?.trim() || previous.profiles.find(x=>x.id===p.id)?.apiKey || ''};
 });
 for (const feature of modelFeatures) if (!ids.has(input.features?.[feature])) throw new Error(`请为 ${feature} 选择模型`);
 const settings: ModelSettings = {version:1,profiles,features:Object.fromEntries(modelFeatures.map(f=>[f,input.features[f]])) as ModelSettings['features']};
 mkdirSync(dataDirectory(),{recursive:true});
 const temp = `${settingsPath()}.${randomUUID()}.tmp`;
 writeFileSync(temp,JSON.stringify(settings,null,2),{mode:0o600}); renameSync(temp,settingsPath()); chmodSync(settingsPath(),0o600);
 return publicSettings();
}
export class ModelNotConfiguredError extends Error {}
export function resolveModel(feature: ModelFeature, snapshot?: ModelSnapshot | null): ModelProfile {
 const context = modelContext.getStore(); if (context && !snapshot) return context;
 const settings = readSettings(); const profile = settings.profiles.find(p=>p.id===(snapshot?.id || settings.features[feature]));
 if (!profile?.apiKey || !(snapshot?.model || profile.model) || !(snapshot?.baseUrl || profile.baseUrl)) throw new ModelNotConfiguredError(`模型配置不完整（${feature}），请到“本地设置”填写服务地址、模型名称和 API 密钥。`);
 return snapshot ? {...snapshot,apiKey:profile.apiKey} : profile;
}
export function modelSnapshot(feature: ModelFeature) { const {apiKey,...snapshot} = resolveModel(feature); return snapshot; }
export function safeModelError(error: unknown) {
 let message = error instanceof Error ? error.message : String(error);
 try {for (const profile of readSettings().profiles) if (profile.apiKey) message = message.split(profile.apiKey).join('[密钥已隐藏]');} catch { /* Configuration parse errors contain no file contents. */ }
 return message.slice(0,1000);
}
export function endpoint(profile: ModelProfile) {
 const base = profile.baseUrl.replace(/\/(chat\/completions|responses)\/?$/,'').replace(/\/$/,'');
 return `${base}/${profile.apiMode === 'responses' ? 'responses' : 'chat/completions'}`;
}
export async function modelRequest(profile: ModelProfile, messages: unknown[], json = false, test = false): Promise<string> {
 const signal = AbortSignal.timeout(test ? Math.min(profile.timeoutMs,10000) : profile.timeoutMs);
 try {
  const body = profile.apiMode === 'responses'
   ? {model:profile.model,input:messages,max_output_tokens:test?16:profile.maxTokens,...(json?{text:{format:{type:'json_object'}}}:{})}
   : {model:profile.model,messages,temperature:profile.temperature,max_tokens:test?1:profile.maxTokens,...(json?{response_format:{type:'json_object'}}:{})};
  const response = await fetch(endpoint(profile),{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${profile.apiKey}`},body:JSON.stringify(body),signal});
  if (!response.ok) {
   const reasons: Record<number,string> = {400:'请求参数或协议不受支持',401:'API 密钥无效',403:'权限不足',404:'服务地址或模型不存在',429:'额度不足或请求频率受限',500:'模型服务内部错误',502:'模型网关异常',503:'模型服务暂不可用'};
   throw new Error(`模型连接失败：HTTP ${response.status}，${reasons[response.status] || '请检查模型服务状态'}。`);
  }
  const result = await response.json();
  const content = profile.apiMode === 'responses' ? result.output_text || result.output?.flatMap((item:any)=>item.content || []).find((c:any)=>c.type==='output_text')?.text : result.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || (!test && !content.trim())) throw new Error('模型返回内容为空或响应协议不匹配');
  return content;
 } catch(error) {
  if (signal.aborted) throw new Error(`模型连接超时（${test ? Math.min(profile.timeoutMs,10000) : profile.timeoutMs}ms），请检查服务地址和网络。`);
  if (error instanceof TypeError) throw new Error('模型网络连接失败，请检查服务地址、DNS、代理或 TLS 证书。');
  throw new Error(safeModelError(error));
 }
}
export async function testModel(feature: ModelFeature) {
 const profile = resolveModel(feature); const started = Date.now();
 await modelRequest(profile,[{role:'user',content:'Reply OK'}],false,true);
 return {ok:true,model:profile.model,latencyMs:Date.now()-started};
}
