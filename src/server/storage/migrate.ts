import { readData } from '../data/store';
import { readContentOperationsData } from '../content-operations/store';
import { readAigcJobs } from '../aigc/jobStore';
import { database, dataDirectory } from './database';
import path from 'node:path';
export async function migrateAll() {
  await readData(); await readContentOperationsData(); await readAigcJobs();
  database().migrate('rag', path.join(dataDirectory(), 'rag-demo-data.json'), { documents: [] });
}
