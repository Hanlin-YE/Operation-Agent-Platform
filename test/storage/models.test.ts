import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createServer } from 'node:http';
import { publicSettings, saveSettings, modelSnapshot, resolveModel, modelRequest, ModelSettings } from '../../src/server/models/settings';
test('settings mask secrets, preserve blank key, bind model snapshots and report HTTP failures', async()=>{
 process.env.LOCAL_DATA_DIR=mkdtempSync(path.join(tmpdir(),'ops-models-'));
 let status=200;
 const server=createServer((_req,res)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify({choices:[{message:{content:'OK'}}]}));});
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
 const address=server.address() as {port:number};
 const settings:ModelSettings={version:1,profiles:[{id:'one',name:'模型一',apiKey:'unit-test-secret-key',baseUrl:`http://127.0.0.1:${address.port}/v1`,model:'model-a',temperature:0.4,maxTokens:50,timeoutMs:1000,apiMode:'chat_completions'}],features:{sales:'one',content:'one',video:'one',learning:'one'}};
 try{
  const saved=saveSettings(settings);
  assert.ok(!JSON.stringify(saved).includes('unit-test-secret-key'));assert.equal(saved.profiles[0].maskedKey,'••••-key');
  assert.equal(statSync(path.join(process.env.LOCAL_DATA_DIR,'model-settings.json')).mode&0o777,0o600);
  const snapshot=modelSnapshot('sales');
  settings.profiles[0].apiKey='';settings.profiles[0].model='model-b';saveSettings(settings);
  assert.equal(resolveModel('sales').apiKey,'unit-test-secret-key');assert.equal(resolveModel('sales',snapshot).model,'model-a');
  assert.equal(await modelRequest(resolveModel('sales'),[{role:'user',content:'hello'}]),'OK');
  status=401;await assert.rejects(()=>modelRequest(resolveModel('sales'),[]),/401.*密钥无效/);
  assert.ok(!JSON.stringify(publicSettings()).includes('unit-test-secret-key'));
 }finally{server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));delete process.env.LOCAL_DATA_DIR;}
});
