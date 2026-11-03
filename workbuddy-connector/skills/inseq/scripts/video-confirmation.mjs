import {InseqError} from './client.mjs';

export const APPROVE='确认生成';
export const DECLINE='取消生成';
const uuid=/^[0-9a-f]{8}-[0-9a-f-]{27}$/i;
export function identifiers(project,request){
  if(!uuid.test(project)||!uuid.test(request))throw new InseqError('INVALID_QUOTE','报价编号无效');
}
export function questionFor(quote){
  const refs=quote.references?.map((r,i)=>`参考视频 ${i+1}：${r.title||r.id}（${r.duration} 秒）`).join('\n');
  return `本次视频预计 ${quote.estimated_credits} 积分\n时长：${quote.duration} 秒；比例：${quote.ratio}；清晰度：${quote.resolution}；声音：${quote.audio==='on'?'有声':'无声'}\n参考图片：${quote.has_image?'本次已提交图片':'无'}\n${refs||'参考视频：无'}\n内容：${quote.prompt}\n报价：${quote.request_id}\n是否按以上报价和规格生成？`;
}
export function workbuddyQuestion(quote){
  return {question:questionFor(quote),header:'INSEQ 视频报价',multiSelect:false,options:[
    {label:DECLINE,description:'取消本次生成'},
    {label:APPROVE,description:`按本次报价预计 ${quote.estimated_credits} 积分提交`} ]};
}
export async function prepareVideo(client,project,request,sessionId,signal){
  identifiers(project,request);
  if(typeof sessionId!=='string'||!sessionId||sessionId.length>200)throw new InseqError('HOST_SESSION_REQUIRED','请在原宿主对话中确认本次报价');
  const value=await client.authenticated(`/agent/video-approvals/${project}/${request}/prepare`,{method:'POST',body:{session_id:sessionId},signal});
  if(value.state!=='pending')return value;
  return {...value,project_id:project,request_id:request,session_id:sessionId,origin:client.origin};
}
export async function decideVideo(client,pending,decision,interactionId,signal){
  if(pending.origin!==client.origin)throw new InseqError('INVALID_QUOTE','报价来源无效');
  const identity=await client.authenticated('/agent/session',{signal});
  if(identity.account_id!==pending.account_id)throw new InseqError('ACCOUNT_CHANGED','请切回取得本次报价的账号');
  if(pending.quote.expires_at*1000<=Date.now())throw new InseqError('QUOTE_EXPIRED','本次报价已过期，请重新报价');
  return client.authenticated(`/agent/video-approvals/${pending.project_id}/${pending.request_id}/decision`,{
    method:'POST',signal,accountId:pending.account_id,body:{decision,estimated_credits:pending.quote.estimated_credits,
      session_id:pending.session_id,receipt:pending.receipt,interaction_id:interactionId}});
}
export async function confirmDeepseek(client,ctx,exec,project,request){
  if(!exec.agent?.session?.id||!exec.callId||!ctx.get('userQuestions'))throw new InseqError('CONFIRMATION_UNAVAILABLE','当前会话无法显示本人报价确认，请在主对话中重试');
  const pending=await prepareVideo(client,project,request,String(exec.agent.session.id),exec.signal);
  if(pending.state!=='pending')return pending;
  const answer=await ctx.get('userQuestions').ask({agent:exec.agent,
    signal:AbortSignal.any([exec.signal,AbortSignal.timeout(Math.max(1,pending.quote.expires_at*1000-Date.now()))].filter(Boolean)),
    questions:[{id:request,question:questionFor(pending.quote),options:[{label:DECLINE},{label:APPROVE}],
      intent:{kind:'approval',approve:APPROVE,reject:DECLINE,subject:{name:'INSEQ'}}}]});
  const choice=answer?.answers;
  if(choice?.length!==1||choice[0].id!==request||choice[0].custom||choice[0].selected?.length!==1
      ||![APPROVE,DECLINE].includes(choice[0].selected[0]))throw new InseqError('NOT_CONFIRMED','本次报价未确认，尚未提交');
  return decideVideo(client,pending,choice[0].selected[0]===APPROVE?'allow':'deny',String(exec.callId),exec.signal);
}
