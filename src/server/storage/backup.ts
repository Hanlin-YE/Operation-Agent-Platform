import { DatabaseSync } from 'node:sqlite';
import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync, existsSync, readdirSync, lstatSync, readFileSync, writeFileSync, copyFileSync, renameSync, unlinkSync, chmodSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { database, dataDirectory } from './database';
import { migrateAll } from './migrate';
import { TaskStore } from '../tasks/store';
type Entry = { file:string; sha256:string };
type Manifest = {version:1;createdAt:string;files:Entry[]};
const hash = (file:string)=>createHash('sha256').update(readFileSync(file)).digest('hex');
const roots = () => ({data:dataDirectory(),agent:path.resolve(process.env.LOCAL_AGENT_DATA_DIR || path.join(process.cwd(),'agent_root','data'))});
function copyTree(from:string,to:string) {
 if(!existsSync(from))return;
 if(lstatSync(from).isSymbolicLink())throw new Error(`备份目录包含符号链接：${from}`);
 if(lstatSync(from).isDirectory()){mkdirSync(to,{recursive:true});for(const file of readdirSync(from))copyTree(path.join(from,file),path.join(to,file));}
 else {mkdirSync(path.dirname(to),{recursive:true});copyFileSync(from,to);chmodSync(to,0o600);}
}
function walk(root:string,prefix=''):string[]{return readdirSync(root).flatMap(name=>{const file=path.join(prefix,name);return lstatSync(path.join(root,name)).isDirectory()?walk(path.join(root,name),file):[file];});}
export async function createBackup() {
 await migrateAll();new TaskStore(database());
 const directory=path.join(dataDirectory(),'backups',`${new Date().toISOString().replace(/[:.]/g,'-')}-${randomUUID().slice(0,8)}`);
 mkdirSync(directory,{recursive:true,mode:0o700});
 database().sql.prepare('VACUUM INTO ?').run(path.join(directory,'operations.sqlite'));
 // Attachments are immutable: files copied after the snapshot include every referenced blob.
 for(const folder of ['attachments','rag-demo-files'])copyTree(path.join(roots().data,folder),path.join(directory,'data',folder));
 const videoDb=path.join(roots().agent,'video-analysis-jobs.sqlite');
 if(existsSync(videoDb)){
  const sql=new DatabaseSync(videoDb,{readOnly:true});
  try{sql.prepare('VACUUM INTO ?').run(path.join(directory,'video-analysis-jobs.sqlite'));}finally{sql.close();}
 }
 const legacyVideo=path.join(roots().agent,'video-analysis-jobs.json');
 if(!existsSync(videoDb)&&existsSync(legacyVideo))copyTree(legacyVideo,path.join(directory,'agent','video-analysis-jobs.json'));
 copyTree(path.join(roots().agent,'video-sources'),path.join(directory,'agent','video-sources'));
 const files=walk(directory).map(file=>({file,sha256:hash(path.join(directory,file))}));
 const manifest:Manifest={version:1,createdAt:new Date().toISOString(),files};
 for(const {file} of files)chmodSync(path.join(directory,file),0o600);
 writeFileSync(path.join(directory,'manifest.json'),JSON.stringify(manifest,null,2),{mode:0o600});
 return directory;
}
export function validateBackup(directory:string) {
 const manifest=JSON.parse(readFileSync(path.join(directory,'manifest.json'),'utf8')) as Manifest;
 if(manifest.version!==1||!Array.isArray(manifest.files)||!manifest.files.some(e=>e.file==='operations.sqlite'))throw new Error('备份清单格式无效');
 const seen=new Set<string>();
 for(const entry of manifest.files){
  if(typeof entry.file!=='string'||entry.file.split(/[\\/]/).some(part=>part==='..')||path.isAbsolute(entry.file)||seen.has(entry.file))throw new Error('备份路径无效或重复');
  if(!['operations.sqlite','video-analysis-jobs.sqlite','agent/video-analysis-jobs.json'].includes(entry.file)&&!/^data\/(attachments|rag-demo-files)\//.test(entry.file)&&!entry.file.startsWith('agent/video-sources/'))throw new Error('备份包含未知文件');
  seen.add(entry.file);
  const file=path.join(directory,entry.file);
  if(!realpathSync(file).startsWith(realpathSync(directory)+path.sep)||lstatSync(file).isSymbolicLink()||hash(file)!==entry.sha256)throw new Error(`备份校验失败：${entry.file}`);
 }
 for(const name of ['operations.sqlite','video-analysis-jobs.sqlite'])if(seen.has(name)){
  const sql=new DatabaseSync(path.join(directory,name),{readOnly:true});
  try{if(Object.values(sql.prepare('PRAGMA integrity_check').get() || {})[0]!=='ok')throw new Error('数据库完整性校验失败');}
  finally{sql.close();}
 }
 return manifest;
}
export async function restoreBackup(directory:string,offline:boolean) {
 if(!offline)throw new Error('恢复前请停止应用、worker 和视频服务，再添加 --offline 参数。');
 directory=path.resolve(directory);const manifest=validateBackup(directory);
 const store=new TaskStore(database());
 if(store.online())throw new Error('后台执行器仍在线；停止后等待 30 秒或正常退出，再恢复。');
 const safetyBackup=await createBackup();
 const journal:{target:string;old:Buffer|null}[]=[];
 database().sql.prepare('ATTACH DATABASE ? AS restore_source').run(path.join(directory,'operations.sqlite'));
 const hasVideo=manifest.files.some(entry=>entry.file==='video-analysis-jobs.sqlite');
 if(hasVideo){
  mkdirSync(roots().agent,{recursive:true});
  database().sql.prepare('ATTACH DATABASE ? AS live_video').run(path.join(roots().agent,'video-analysis-jobs.sqlite'));
  database().sql.prepare('ATTACH DATABASE ? AS video_source').run(path.join(directory,'video-analysis-jobs.sqlite'));
 }
 try {
  database().transaction(()=>{
   for(const entry of manifest.files){
    if(['operations.sqlite','video-analysis-jobs.sqlite'].includes(entry.file))continue;
    const target=entry.file==='video-analysis-jobs.sqlite'?path.join(roots().agent,entry.file):path.join(entry.file.startsWith('data/')?roots().data:roots().agent,entry.file.replace(/^(data|agent)\//,''));
    if(existsSync(target)&&hash(target)===entry.sha256)continue;
    journal.push({target,old:existsSync(target)?readFileSync(target):null});
    mkdirSync(path.dirname(target),{recursive:true});copyFileSync(path.join(directory,entry.file),`${target}.restore.tmp`);chmodSync(`${target}.restore.tmp`,0o600);renameSync(`${target}.restore.tmp`,target);
   }
   if(hasVideo){
    database().sql.exec('CREATE TABLE IF NOT EXISTS live_video.jobs(id TEXT PRIMARY KEY,payload TEXT NOT NULL,dedupe TEXT UNIQUE,owner_pid INTEGER); CREATE TABLE IF NOT EXISTS live_video.migrations(name TEXT PRIMARY KEY); DELETE FROM live_video.jobs; INSERT INTO live_video.jobs SELECT id,payload,dedupe,NULL FROM video_source.jobs; DELETE FROM live_video.migrations; INSERT INTO live_video.migrations SELECT * FROM video_source.migrations;');
   }
   // Fixed table names only; preserve the live connection and WAL coherency.
   for(const table of ['records','migrations','tasks','task_attempts','task_checkpoints']){
    database().sql.exec(`DELETE FROM main.${table}; INSERT INTO main.${table} SELECT * FROM restore_source.${table};`);
   }
   database().sql.exec("DELETE FROM workers; UPDATE tasks SET status='interrupted',owner=NULL,leaseUntil=NULL,error='从备份恢复的未完成任务，请确认后重试' WHERE status IN ('running','queued'); UPDATE task_attempts SET status='interrupted' WHERE status='running';");
  });
 }catch(error){
  for(const {target,old} of journal.reverse()) { if(old)writeFileSync(target,old,{mode:0o600});else if(existsSync(target))unlinkSync(target); }
  throw error;
 }finally{database().sql.exec('DETACH DATABASE restore_source');if(hasVideo)database().sql.exec('DETACH DATABASE live_video; DETACH DATABASE video_source;');}
 return {safetyBackup,restored:directory};
}
