import { spawn } from 'node:child_process';
const mode = process.argv[2] || 'dev';
if (!['dev','start'].includes(mode)) throw new Error('Expected dev or start');
const extraArgs=process.argv.slice(3);
if(!extraArgs.some(arg=>arg==='--hostname'||arg==='-H'||arg.startsWith('--hostname=')))extraArgs.push('--hostname','127.0.0.1');
const children = [
 spawn(process.execPath,['node_modules/next/dist/bin/next',mode,...extraArgs],{stdio:'inherit',env:{...process.env,...(mode==='dev'?{NEXT_DIST_DIR:process.env.NEXT_DIST_DIR || '.next-dev'}:{})}}),
 spawn(process.execPath,['--import','tsx','scripts/task-worker.ts'],{stdio:'inherit',env:process.env})
];
let stopping = false;
function stop(code=0) { if(stopping)return; stopping=true; for(const child of children) child.kill('SIGTERM'); setTimeout(()=>{for(const child of children) child.kill('SIGKILL');process.exit(code);},5000).unref(); }
for(const child of children) child.on('exit',code=>stop(code || 0));
process.on('SIGINT',()=>stop()); process.on('SIGTERM',()=>stop());
