import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { taskStore } from '../src/server/tasks/store';
import { executeTask } from '../src/server/tasks/handlers';
import { migrateAll } from '../src/server/storage/migrate';
import { safeModelError } from '../src/server/models/settings';
import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());
async function main() {
 await migrateAll();
 const store = taskStore(); const owner = `${process.pid}:${randomUUID()}`;
 let stopping = false;
 const stop = () => { stopping=true; };
 process.on('SIGTERM',stop); process.on('SIGINT',stop);
 store.heartbeat(owner);
 const heartbeat = setInterval(()=>store.heartbeat(owner),5000);
 console.log('SQLite 后台任务 worker 已启动');
 try {
  while (!stopping) {
   store.recover(); const task = store.claim(owner);
   if (!task) { await delay(1000); continue; }
   try { const result = await executeTask(task,store,owner); store.finish(task.id,owner,'succeeded',result); }
   catch(error) { store.finish(task.id,owner,'failed',null,safeModelError(error)); }
  }
 } finally { clearInterval(heartbeat); store.db.sql.prepare('DELETE FROM workers WHERE id=?').run(owner); }
}
main().catch(error=>{ console.error(safeModelError(error)); process.exit(1); });
