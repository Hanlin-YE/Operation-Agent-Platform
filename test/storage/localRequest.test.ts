import { test } from 'node:test';
import assert from 'node:assert/strict';
import { requireLocalMutation } from '../../src/server/http/local';
test('same-origin uses incoming Host even when Next normalizes the internal request URL',()=>{
 assert.doesNotThrow(()=>requireLocalMutation(new Request('http://localhost:3115/api/tasks',{headers:{host:'127.0.0.1:3115',origin:'http://127.0.0.1:3115','sec-fetch-site':'same-origin'}})));
 assert.throws(()=>requireLocalMutation(new Request('http://localhost:3115/api/tasks',{headers:{host:'127.0.0.1:3115',origin:'https://evil.example','sec-fetch-site':'cross-site'}})),/来源/);
});
