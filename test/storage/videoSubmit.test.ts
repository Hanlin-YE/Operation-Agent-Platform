import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync} from 'node:fs';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {POST} from '../../src/app/api/video-analysis/jobs/route';
import {saveSettings} from '../../src/server/models/settings';
import {taskStore} from '../../src/server/tasks/store';
import {readAttachment} from '../../src/server/storage/attachments';
test('uploaded video is saved as an attachment and repeated submits reuse the same durable task',async(context)=>{
 process.env.LOCAL_DATA_DIR=mkdtempSync(path.join(tmpdir(),'ops-video-submit-'));delete process.env.DEMO_EPHEMERAL_STORE;
 try{
  saveSettings({version:1,profiles:[{id:'test',name:'测试',apiKey:'fake-key',baseUrl:'http://127.0.0.1:9/v1',model:'fake-model',apiMode:'chat_completions',temperature:0.3,maxTokens:100,timeoutMs:1000}],features:{sales:'test',content:'test',video:'test',learning:'test'}});
  let calls=0;context.mock.method(globalThis,'fetch',async()=>{calls++;throw new Error('submit should not invoke models');});
  const submit=async()=>{const form=new FormData();form.set('video',new File(['video-bytes'],'sample.mp4',{type:'video/mp4'}));return POST(new Request('http://localhost/api/video-analysis/jobs',{method:'POST',body:form}));};
  const first=await submit();assert.equal(first.status,202);const job=await first.json();const second=await submit();assert.equal((await second.json()).jobId,job.jobId);
  const stored=taskStore().get(job.jobId)!;assert.equal(stored.status,'queued');assert.equal((await readAttachment(stored.payload.attachment)).toString(),'video-bytes');
  assert.equal(calls,0);assert.ok(!JSON.stringify(stored).includes('fake-key'));assert.ok(!JSON.stringify(stored.payload).includes('video-bytes'));
 }finally{delete process.env.LOCAL_DATA_DIR;}
});
