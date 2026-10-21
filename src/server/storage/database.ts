import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, existsSync, readFileSync, chmodSync, copyFileSync } from 'node:fs';
import path from 'node:path';

type Row = { collection: string; record_id: string; value: string; position: number };
const encode = (value: unknown) => JSON.stringify(value);
// Each top-level collection item has its own SQLite row. Snapshot writes only
// apply changed records, never replace records added by another request/process.
function rows(value: any): Map<string, Row> {
  const result = new Map<string, Row>();
  for (const [collection, entries] of Object.entries(value)) {
    const keyed = Array.isArray(entries) && entries.every(x => x && typeof x === 'object' && (x.id || x.jobId || x.commentId));
    if (keyed) {
      result.set(`${collection}\0@array`, { collection, record_id: '@array', value: '[]', position: -1 });
      (entries as any[]).forEach((entry, position) => {
        const record_id = String(entry.id || entry.jobId || entry.commentId);
        const key = `${collection}\0${record_id}`;
        if (result.has(key)) throw new Error(`重复记录 ID：${collection}/${record_id}`);
        result.set(key, { collection, record_id, value: encode(entry), position });
      });
    } else result.set(`${collection}\0@value`, { collection, record_id: '@value', value: encode(entries), position: 0 });
  }
  return result;
}

export class LocalDatabase {
  readonly sql: DatabaseSync;
  private snapshots = new WeakMap<object, Map<string, Row>>();
  constructor(readonly filename: string) {
    if (filename !== ':memory:') mkdirSync(path.dirname(filename), { recursive: true });
    this.sql = new DatabaseSync(filename);
    this.sql.exec('PRAGMA busy_timeout=10000; PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA foreign_keys=ON;');
    if (filename !== ':memory:') chmodSync(filename, 0o600);
    this.sql.exec(`CREATE TABLE IF NOT EXISTS migrations(namespace TEXT PRIMARY KEY, source TEXT, migrated_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS records(namespace TEXT NOT NULL, collection TEXT NOT NULL, record_id TEXT NOT NULL, value TEXT NOT NULL, position INTEGER NOT NULL, PRIMARY KEY(namespace,collection,record_id));
      PRAGMA user_version=1;`);
  }
  transaction<T>(fn: () => T): T {
    this.sql.exec('BEGIN IMMEDIATE');
    try { const value = fn(); this.sql.exec('COMMIT'); return value; }
    catch (error) { this.sql.exec('ROLLBACK'); throw error; }
  }
  migrate(namespace: string, source: string, seed: object, validate?: (data: any) => void, transform: (data: any) => object = value => value) {
    this.transaction(() => {
      if (this.sql.prepare('SELECT 1 FROM migrations WHERE namespace=?').get(namespace)) return;
      const exists = existsSync(source);
      const data = exists ? transform(JSON.parse(readFileSync(source, 'utf8'))) : seed;
      if (!data || Array.isArray(data) || typeof data !== 'object') throw new Error(`旧数据结构无效：${source}`);
      validate?.(data);
      // Immutable source copy is made before importing. Originals remain untouched.
      if (exists) {
        const backup = `${source}.pre-sqlite.bak`;
        if (!existsSync(backup)) copyFileSync(source, backup);
        chmodSync(backup, 0o600);
      }
      const insert = this.sql.prepare('INSERT INTO records VALUES(?,?,?,?,?)');
      for (const row of rows(data).values()) insert.run(namespace, row.collection, row.record_id, row.value, row.position);
      this.sql.prepare('INSERT INTO migrations VALUES(?,?,?)').run(namespace, exists ? source : 'seed', new Date().toISOString());
    });
  }
  read<T extends object>(namespace: string): T {
    const data: Record<string, any> = {};
    const records = this.sql.prepare('SELECT * FROM records WHERE namespace=? ORDER BY position,record_id').all(namespace) as unknown as Row[];
    for (const row of records) {
      if (row.record_id === '@value') data[row.collection] = JSON.parse(row.value);
      else if (row.record_id === '@array') data[row.collection] ??= [];
      else (data[row.collection] ??= []).push(JSON.parse(row.value));
    }
    this.snapshots.set(data, rows(data));
    return data as T;
  }
  write(namespace: string, data: object) {
    const before = this.snapshots.get(data);
    if (!before) throw new Error('保存需要使用数据库读取的快照，以保护并发修改。');
    const after = rows(data);
    this.transaction(() => {
      const find = this.sql.prepare('SELECT value FROM records WHERE namespace=? AND collection=? AND record_id=?');
      for (const key of new Set([...before.keys(), ...after.keys()])) {
        const old = before.get(key), next = after.get(key);
        if (old?.value === next?.value) continue;
        const row = next || old!;
        const current = find.get(namespace, row.collection, row.record_id) as {value: string} | undefined;
        if (current?.value === next?.value) continue;
        if (current?.value !== old?.value) throw new Error(`记录发生并发修改，请刷新后重试：${row.collection}/${row.record_id}`);
        if (!next) this.sql.prepare('DELETE FROM records WHERE namespace=? AND collection=? AND record_id=?').run(namespace, row.collection, row.record_id);
        else this.sql.prepare('INSERT INTO records VALUES(?,?,?,?,?) ON CONFLICT(namespace,collection,record_id) DO UPDATE SET value=excluded.value,position=excluded.position').run(namespace, next.collection, next.record_id, next.value, next.position);
      }
    });
    this.snapshots.set(data, after);
  }
  close() { this.sql.close(); }
}

const host = globalThis as typeof globalThis & { __localDatabases?: Map<string, LocalDatabase> };
export function dataDirectory() { return path.resolve(process.env.LOCAL_DATA_DIR || path.join(process.cwd(), 'data')); }
export function database(): LocalDatabase {
  const filename = path.join(dataDirectory(), 'operations.sqlite');
  const cache = host.__localDatabases ??= new Map<string, LocalDatabase>();
  if (!cache.has(filename)) cache.set(filename, new LocalDatabase(filename));
  return cache.get(filename)!;
}
