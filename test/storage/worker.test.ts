import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawn, ChildProcess } from 'node:child_process';
import { createServer } from 'node:http';
import { setTimeout as delay } from 'node:timers/promises';
import { readData } from '../../src/server/data/store';
import { taskStore } from '../../src/server/tasks/store';
import { saveSettings, modelSnapshot } from '../../src/server/models/settings';
async function until(condition:()=>boolean, timeout=10000){const start=Date.now();while(!condition()){if(Date.now()-start>timeout)throw new Error('等待 worker 状态超时');await delay(30);}}
async function kill(child:ChildProcess){if(child.exitCode!==null||child.signalCode)return;const done=new Promise<void>(resolve=>child.once('exit',()=>resolve()));child.kill('SIGKILL');await done;}
test('separate worker completes without a page, persists after restart, and retries a killed model task',async()=>{
 process.env.LOCAL_DATA_DIR=mkdtempSync(path.join(tmpdir(),'ops-worker-'));
 delete process.env.DEMO_EPHEMERAL_STORE;
 let requests=0;let hold=true;
 const server=createServer((_req,res)=>{requests++;if(!hold){res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({choices:[{message:{content:'已生成的测试话术'}}]}));}});
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
 const port=(server.address() as {port:number}).port;
 let worker:ChildProcess | undefined;
 let stderr='';
 const start=()=>{const child=spawn(process.execPath,['--import','tsx','scripts/task-worker.ts'],{cwd:process.cwd(),env:{...process.env,DEMO_EPHEMERAL_STORE:'false'},stdio:['ignore','pipe','pipe']});child.stderr!.on('data',chunk=>{stderr+=String(chunk);});return child;};
 try{
  const data=await readData();const leadId=data.leads[0].id;const store=taskStore();
  const task=store.submit('batch-score',{leadIds:[leadId]},null);
  worker=start();await until(()=>store.get(task.id)?.status==='succeeded');
  assert.equal((await readData()).scores.filter(s=>s.leadId===leadId).length,data.scores.filter(s=>s.leadId===leadId).length+1);
  const duplicate=store.submit('batch-score',{leadIds:[leadId]},null);assert.equal(duplicate.id,task.id);
  saveSettings({version:1,profiles:[{id:'test',name:'测试',apiKey:'test-only-key',baseUrl:`http://127.0.0.1:${port}/v1`,model:'mock-model',apiMode:'chat_completions',temperature:0.3,maxTokens:100,timeoutMs:60000}],features:{sales:'test',content:'test',video:'test',learning:'test'}});
  const pitch=store.submit('pitch',{leadId,channel:'wechat'},modelSnapshot('sales'));
  await until(()=>requests===1);await kill(worker);worker=undefined;
  store.recover(Date.now()+31000);assert.equal(store.get(pitch.id)?.status,'interrupted');
  hold=false;server.closeAllConnections();
  store.retry(pitch.id,modelSnapshot('sales'));worker=start();
  await until(()=>store.get(pitch.id)?.status==='succeeded');
  assert.equal(store.get(pitch.id)?.attempt,2);assert.equal(store.attempts(pitch.id).length,2);
  assert.equal(store.get(pitch.id)?.result.content,'已生成的测试话术');assert.equal(requests,2);
  assert.equal(store.get(task.id)?.status,'succeeded');
 }catch(error){throw new Error(`${error}\n${stderr}`);}
 finally{if(worker)await kill(worker);server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));delete process.env.LOCAL_DATA_DIR;}
});
