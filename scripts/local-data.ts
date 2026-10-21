import { migrateAll } from '../src/server/storage/migrate';
import { createBackup, restoreBackup } from '../src/server/storage/backup';
import { database } from '../src/server/storage/database';
async function main(){
 const command=process.argv[2];
 if(command==='migrate'){await migrateAll();console.log(database().sql.prepare('SELECT namespace,source,migrated_at FROM migrations').all());}
 else if(command==='backup')console.log(await createBackup());
 else if(command==='restore'){if(!process.argv[3])throw new Error('请提供备份目录');console.log(await restoreBackup(process.argv[3],process.argv.includes('--offline')));}
 else throw new Error('命令：migrate / backup / restore <备份目录> --offline');
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
