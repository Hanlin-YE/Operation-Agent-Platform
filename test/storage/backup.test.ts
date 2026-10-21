import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { createBackup,restoreBackup,validateBackup } from '../../src/server/storage/backup';
import { saveAttachment } from '../../src/server/storage/attachments';
import { readData,writeData } from '../../src/server/data/store';
import { taskStore } from '../../src/server/tasks/store';
test('backup restores records and attachments, rejects corruption before modifying live data',async()=>{
 process.env.LOCAL_DATA_DIR=mkdtempSync(path.join(tmpdir(),'ops-backup-'));
 process.env.LOCAL_AGENT_DATA_DIR=mkdtempSync(path.join(tmpdir(),'ops-agent-backup-'));
 delete process.env.DEMO_EPHEMERAL_STORE;
 try{
  const videoDb=new DatabaseSync(path.join(process.env.LOCAL_AGENT_DATA_DIR,'video-analysis-jobs.sqlite'));
  videoDb.exec("PRAGMA journal_mode=WAL;CREATE TABLE jobs(id TEXT PRIMARY KEY,payload TEXT NOT NULL,dedupe TEXT UNIQUE,owner_pid INTEGER);CREATE TABLE migrations(name TEXT PRIMARY KEY);INSERT INTO jobs VALUES('old','{}',NULL,NULL);");
  const original=await readData();const count=original.leads.length;
  const attachment=await saveAttachment(Buffer.from('test PDF bytes'),'pdf');
  const task=taskStore().submit('batch-score',{leadIds:[]},null);
  const backup=await createBackup();validateBackup(backup);
  videoDb.exec("DELETE FROM jobs; INSERT INTO jobs VALUES('new','{}',NULL,NULL);");
  const changed=await readData();changed.leads=[];await writeData(changed);
  assert.equal((await readData()).leads.length,0);
  await restoreBackup(backup,true);
  assert.equal((await readData()).leads.length,count);
  assert.equal(taskStore().get(task.id)?.status,'interrupted');
  assert.equal(videoDb.prepare('SELECT id FROM jobs').get()?.id,'old');
  videoDb.close();
  assert.equal(readFileSync(path.join(process.env.LOCAL_DATA_DIR,attachment),'utf8'),'test PDF bytes');
  writeFileSync(path.join(backup,'operations.sqlite'),'corrupt');
  await assert.rejects(()=>restoreBackup(backup,true),/校验失败/);
  assert.equal((await readData()).leads.length,count);
 }finally{delete process.env.LOCAL_DATA_DIR;delete process.env.LOCAL_AGENT_DATA_DIR;}
});
