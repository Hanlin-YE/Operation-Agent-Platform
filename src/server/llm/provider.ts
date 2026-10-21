import { modelRequest, resolveModel, safeModelError, ModelNotConfiguredError } from '../models/settings';
type CompletionInput = { system: string; user: string };
export type JsonCompletionResult<T> = {status:'ok';data:T} | {status:'model_not_configured'} | {status:'error';message:string};
export type JsonCompletionInput = CompletionInput & { images?: {mimeType:string;dataUrl:string}[] };
export async function generateCompletion(input: CompletionInput) {
 const profile = resolveModel('sales');
 return modelRequest(profile,[{role:'system',content:input.system},{role:'user',content:input.user}]);
}
export async function generateJsonCompletion<T>(input: JsonCompletionInput): Promise<JsonCompletionResult<T>> {
 try {
  const profile = resolveModel('content');
  const content: any[] = [{type:'text',text:input.user}];
  for (const image of input.images || []) content.push({type:'image_url',image_url:{url:image.dataUrl}});
  const messages = [{role:'system',content:input.system},{role:'user',content:input.images?.length ? content : input.user}];
  if (profile.apiMode === 'responses' && input.images?.length) messages[1].content = content.map(item=>item.type==='text'?{type:'input_text',text:item.text}:{type:'input_image',image_url:item.image_url.url});
  const raw = await modelRequest(profile,messages,true);
  return {status:'ok',data:JSON.parse(raw.replace(/^```json\s*/i,'').replace(/\s*```$/,'').trim()) as T};
 } catch(error) { return error instanceof ModelNotConfiguredError ? {status:'model_not_configured'} : {status:'error',message:safeModelError(error)}; }
}
