import { createHash, randomUUID } from 'node:crypto';
import { database, LocalDatabase } from '../storage/database';
import type { ModelSnapshot } from '../models/settings';
export type TaskKind = 'batch-score' | 'pitch' | 'content-strategy' | 'content-rework' | 'video';
export type TaskStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'interrupted';
export type BackgroundTask = { id: string; kind: TaskKind; status: TaskStatus; payload: any; model: ModelSnapshot | null; progress: number; message: string; result: any; error: string | null; attempt: number; createdAt: string; updatedAt: string; owner: string | null; leaseUntil: number | null };
function stable(value: any): string { return JSON.stringify(value, (_key, entry) => entry && typeof entry === 'object' && !Array.isArray(entry) ? Object.fromEntries(Object.keys(entry).sort().map(k=>[k,entry[k]])) : entry); }
const decode = (row: any): BackgroundTask | null => row ? { ...row, payload: JSON.parse(row.payload), model: JSON.parse(row.model), result: JSON.parse(row.result) } : null;
export class TaskStore {
 constructor(readonly db: LocalDatabase) {
  db.sql.exec(`CREATE TABLE IF NOT EXISTS tasks (
   id TEXT PRIMARY KEY, kind TEXT NOT NULL, status TEXT NOT NULL, payload TEXT NOT NULL, model TEXT NOT NULL,
   progress INTEGER NOT NULL DEFAULT 0, message TEXT NOT NULL DEFAULT '', result TEXT NOT NULL DEFAULT 'null', error TEXT,
   attempt INTEGER NOT NULL DEFAULT 0, createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL, owner TEXT, leaseUntil INTEGER,
   dedupe TEXT NOT NULL UNIQUE);
   CREATE INDEX IF NOT EXISTS tasks_queue ON tasks(status, createdAt);
   CREATE TABLE IF NOT EXISTS task_attempts(task_id TEXT NOT NULL, attempt INTEGER NOT NULL, model TEXT NOT NULL, startedAt TEXT NOT NULL, finishedAt TEXT, status TEXT NOT NULL, error TEXT, PRIMARY KEY(task_id,attempt));
   CREATE TABLE IF NOT EXISTS workers(id TEXT PRIMARY KEY, heartbeat INTEGER NOT NULL);
   CREATE TABLE IF NOT EXISTS task_checkpoints(task_id TEXT PRIMARY KEY,value TEXT NOT NULL);`);
 }
 submit(kind: TaskKind, payload: unknown, model: ModelSnapshot | null, key?: string) {
  const dedupe = createHash('sha256').update(stable({kind,payload,model,key})).digest('hex');
  const now = new Date().toISOString();
  this.db.sql.prepare("INSERT OR IGNORE INTO tasks(id,kind,status,payload,model,createdAt,updatedAt,dedupe) VALUES(?,?,'queued',?,?,?,?,?)").run(randomUUID(),kind,stable(payload),JSON.stringify(model),now,now,dedupe);
  return decode(this.db.sql.prepare('SELECT * FROM tasks WHERE dedupe=?').get(dedupe))!;
 }
 checkpoint(id: string, value?: unknown): any {
  if(value!==undefined)this.db.sql.prepare('INSERT INTO task_checkpoints VALUES(?,?) ON CONFLICT(task_id) DO UPDATE SET value=excluded.value').run(id,JSON.stringify(value));
  const row=this.db.sql.prepare('SELECT value FROM task_checkpoints WHERE task_id=?').get(id);
  return row?JSON.parse(String(row.value)):null;
 }
 get(id: string) { return decode(this.db.sql.prepare('SELECT * FROM tasks WHERE id=?').get(id)); }
 list() { return this.db.sql.prepare('SELECT * FROM tasks ORDER BY createdAt DESC LIMIT 200').all().map(row=>decode(row)!); }
 attempts(id: string) { return this.db.sql.prepare('SELECT * FROM task_attempts WHERE task_id=? ORDER BY attempt').all(id).map(row=>({...row,model:JSON.parse(String(row.model))})); }
 heartbeat(owner: string, now = Date.now()) {
  this.db.sql.prepare('INSERT INTO workers VALUES(?,?) ON CONFLICT(id) DO UPDATE SET heartbeat=excluded.heartbeat').run(owner,now);
  this.db.sql.prepare("UPDATE tasks SET leaseUntil=? WHERE owner=? AND status='running'").run(now+30000,owner);
 }
 online(now = Date.now()) { return Boolean(this.db.sql.prepare('SELECT 1 FROM workers WHERE heartbeat>? LIMIT 1').get(now-30000)); }
 recover(now = Date.now()) {
  this.db.transaction(()=> {
   this.db.sql.prepare("UPDATE task_attempts SET status='interrupted', finishedAt=?,error='执行进程中断；可显式重试，远端调用可能已产生费用。' WHERE status='running' AND task_id IN (SELECT id FROM tasks WHERE status='running' AND leaseUntil<?)").run(new Date(now).toISOString(),now);
   this.db.sql.prepare("UPDATE tasks SET status='interrupted',owner=NULL,leaseUntil=NULL,error='执行进程中断；可显式重试，远端调用可能已产生费用。',updatedAt=? WHERE status='running' AND leaseUntil<?").run(new Date(now).toISOString(),now);
  });
 }
 claim(owner: string, now = Date.now()) {
  return this.db.transaction(()=> {
   const row = this.db.sql.prepare("SELECT id FROM tasks WHERE status='queued' ORDER BY createdAt LIMIT 1").get();
   if (!row) return null;
   this.db.sql.prepare("UPDATE tasks SET status='running',owner=?,leaseUntil=?,attempt=attempt+1,updatedAt=? WHERE id=?").run(owner,now+30000,new Date(now).toISOString(),row.id);
   const task = this.get(String(row.id))!;
   this.db.sql.prepare("INSERT INTO task_attempts(task_id,attempt,model,startedAt,status) VALUES(?,?,?,?,'running')").run(task.id,task.attempt,JSON.stringify(task.model),new Date(now).toISOString());
   return task;
  });
 }
 recordModel(id:string,owner:string,model:ModelSnapshot) {
  this.db.transaction(()=>{
   const row=this.db.sql.prepare("SELECT attempt FROM tasks WHERE id=? AND owner=? AND status='running'").get(id,owner);
   if(!row)throw new Error('任务执行权已失效');
   this.db.sql.prepare('UPDATE tasks SET model=? WHERE id=?').run(JSON.stringify(model),id);
   this.db.sql.prepare('UPDATE task_attempts SET model=? WHERE task_id=? AND attempt=?').run(JSON.stringify(model),id,row.attempt);
  });
 }
 progress(id: string, owner: string, progress: number, message: string) {
  return Number(this.db.sql.prepare("UPDATE tasks SET progress=?,message=?,updatedAt=? WHERE id=? AND owner=? AND status='running'").run(Math.max(0,Math.min(99,progress)),message,new Date().toISOString(),id,owner).changes)>0;
 }
 finish(id: string, owner: string, status: 'succeeded' | 'failed', result: unknown = null, error: string | null = null) {
  return this.db.transaction(()=> {
   const changed = this.db.sql.prepare("UPDATE tasks SET status=?,result=?,error=?,progress=CASE WHEN ?='succeeded' THEN 100 ELSE progress END,updatedAt=?,owner=NULL,leaseUntil=NULL WHERE id=? AND owner=? AND status='running'").run(status,JSON.stringify(result),error,status,new Date().toISOString(),id,owner).changes;
   if (Number(changed)) this.db.sql.prepare('UPDATE task_attempts SET status=?,error=?,finishedAt=? WHERE task_id=? AND attempt=?').run(status,error,new Date().toISOString(),id,this.get(id)!.attempt);
   return Number(changed)>0;
  });
 }
 retry(id: string, model: ModelSnapshot | null) {
  const changed = this.db.sql.prepare("UPDATE tasks SET status='queued',progress=0,message='等待重试',error=NULL,model=?,updatedAt=? WHERE id=? AND status IN ('failed','interrupted')").run(JSON.stringify(model),new Date().toISOString(),id).changes;
  if (!Number(changed)) throw new Error('仅失败或中断任务可重试；任务可能已被其他页面重试。');
  return this.get(id)!;
 }
}
export function taskStore() { return new TaskStore(database()); }
