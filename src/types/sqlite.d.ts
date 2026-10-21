declare module 'node:sqlite' {
  export class DatabaseSync {
    constructor(path: string, options?: { readOnly?: boolean });
    exec(sql: string): void;
    prepare(sql: string): { run(...params: any[]): { changes: number | bigint; lastInsertRowid: number | bigint }; get(...params: any[]): Record<string, unknown> | undefined; all(...params: any[]): Record<string, unknown>[] };
    close(): void;
  }
}
