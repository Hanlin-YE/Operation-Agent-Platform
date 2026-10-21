import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { LocalDatabase } from '../../src/server/storage/database';

test('migration is lossless, idempotent and restart durable; parallel snapshots do not overwrite inserts', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'ops-db-'));
  const legacy = path.join(dir, 'old.json');
  writeFileSync(legacy, JSON.stringify({ leads: [{ id: 'old', name: '原始线索' }] }));
  const db = new LocalDatabase(path.join(dir, 'local.sqlite'));
  db.migrate('app', legacy, { leads: [] });
  const a = db.read<any>('app'), b = db.read<any>('app');
  a.leads.push({ id: 'a' }); b.leads.push({ id: 'b' });
  db.write('app', a); db.write('app', b);
  db.close();
  const reopened = new LocalDatabase(path.join(dir, 'local.sqlite'));
  reopened.migrate('app', legacy, { leads: [] });
  assert.deepEqual(reopened.read<any>('app').leads.map((x: any) => x.id).sort(), ['a','b','old']);
  assert.equal(JSON.parse(readFileSync(legacy, 'utf8')).leads.length, 1);
  reopened.close();
});

test('conflicting updates fail explicitly and transaction rolls back', () => {
  const db = new LocalDatabase(':memory:'); db.migrate('app', '/nonexistent', { leads: [{ id: 'a', name: 'A' }] });
  const a = db.read<any>('app'), b = db.read<any>('app');
  a.leads[0].name = 'B'; b.leads[0].name = 'C'; b.leads.push({ id: 'new' });
  db.write('app', a); assert.throws(() => db.write('app', b), /并发修改/);
  assert.deepEqual(db.read<any>('app').leads, [{id:'a',name:'B'}]); db.close();
});

test('malformed legacy data is preserved and never replaced with seed', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'ops-invalid-')); const file = path.join(dir, 'old.json'); writeFileSync(file, '{broken');
  const db = new LocalDatabase(':memory:'); assert.throws(() => db.migrate('app', file, {}));
  assert.equal(readFileSync(file,'utf8'), '{broken'); db.close();
});
