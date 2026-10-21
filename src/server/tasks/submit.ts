import { taskStore, TaskKind } from './store';
import { modelSnapshot, ModelFeature } from '../models/settings';
export function featureFor(kind: TaskKind): ModelFeature | null { return kind==='batch-score'?null:kind==='pitch'?'sales':kind==='video'?'video':'content'; }
export function submitTask(kind: TaskKind, payload: unknown, key?: string) {
 if (process.env.DEMO_EPHEMERAL_STORE === 'true' || process.env.CLOUDFLARE === 'true') throw new Error('后台任务需要本地持久运行模式');
 const feature = featureFor(kind);
 return taskStore().submit(kind,payload,feature?modelSnapshot(feature):null,key);
}
