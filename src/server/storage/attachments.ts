import { createHash } from 'node:crypto';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { dataDirectory } from './database';
export async function saveAttachment(bytes: Uint8Array, extension: string) {
 const digest = createHash('sha256').update(bytes).digest('hex');
 const name = `${digest}.${extension.replace(/[^a-zA-Z0-9]/g,'').slice(0,12) || 'bin'}`;
 const relative = `attachments/${name}`; const target = path.join(dataDirectory(),relative);
 await mkdir(path.dirname(target),{recursive:true});
 try { await writeFile(target,bytes,{flag:'wx',mode:0o600}); } catch(error) { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error; }
 return relative;
}
export async function readAttachment(relative: string) {
 if (!/^attachments\/[a-f0-9]{64}\.[a-zA-Z0-9]+$/.test(relative)) throw new Error('附件路径无效');
 return readFile(path.join(dataDirectory(),relative));
}
