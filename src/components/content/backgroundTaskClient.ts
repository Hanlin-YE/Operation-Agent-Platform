export async function awaitBackgroundResult<T>(response: Response): Promise<T> {
 const payload = await response.json();
 if (!response.ok) throw new Error(payload.error || '任务提交失败');
 if (response.status !== 202) return payload as T;
 const id = payload.id;
 if (!id) throw new Error('任务服务未返回编号');
 for (;;) {
  const response = await fetch(`/api/tasks/${encodeURIComponent(id)}`,{cache:'no-store'});
  const task = await response.json();
  if (!response.ok) throw new Error(task.error || '任务读取失败');
  if (task.status === 'succeeded') return task.result as T;
  if (['failed','interrupted'].includes(task.status)) throw new Error(`${task.error || '任务失败'}（可在任务中心重试）`);
  await new Promise(resolve=>setTimeout(resolve,1500));
 }
}
