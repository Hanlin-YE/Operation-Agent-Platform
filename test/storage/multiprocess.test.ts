import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { LocalDatabase } from '../../src/server/storage/database';
test('multiple processes save independent records without losing inserts',async()=>{
 const dir=mkdtempSync(path.join(tmpdir(),'ops-concurrent-'));const file=path.join(dir,'shared.sqlite');
 const db=new LocalDatabase(file);db.migrate('test','/nonexistent',{leads:[]});
 const module=path.resolve('src/server/storage/database.ts');
 await Promise.all(Array.from({length:4},(_,worker)=>new Promise<void>((resolve,reject)=>{
  const source=`const {LocalDatabase}=require(${JSON.stringify(module)});const db=new LocalDatabase(${JSON.stringify(file)});(async()=>{for(let i=0;i<15;i++){const data=db.read('test');await new Promise(r=>setTimeout(r,2));data.leads.push({id:'${worker}-'+i});db.write('test',data);}db.close();})();`;
  const child=spawn(process.execPath,['--import','tsx','-e',source],{stdio:['ignore','ignore','pipe']});let error='';child.stderr.on('data',c=>error+=c);child.on('exit',code=>code===0?resolve():reject(new Error(error)));
 })));
 assert.equal(db.read<any>('test').leads.length,60);db.close();
});
