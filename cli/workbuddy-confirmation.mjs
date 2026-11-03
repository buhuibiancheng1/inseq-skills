import {readFile,writeFile,mkdir,rename,lstat} from 'node:fs/promises';
import {join} from 'node:path';
import {homedir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {InseqError} from './client.mjs';
import {prepareVideo,decideVideo,workbuddyQuestion,APPROVE,DECLINE} from './video-confirmation.mjs';

const run=promisify(execFile);
const script=fileURLToPath(new URL('./cli.mjs',import.meta.url));
const keyFor=session=>{
  if(!/^[a-z0-9-]{1,100}$/i.test(session||''))throw new InseqError('HOST_SESSION_REQUIRED','请在 WorkBuddy 当前对话中确认');
  return 'video-'+session.toLowerCase();
};
const quoteShell=s=>"'"+s.replaceAll("'","'\\''")+"'";
const hookCommand=()=>`${quoteShell(process.execPath)} ${quoteShell(script)} _workbuddy_video_hook`;

export async function installWorkbuddyHooks(root=process.env.WORKBUDDY_CONFIG_DIR||join(homedir(),'.workbuddy')){
  const path=join(root,'settings.json');
  let settings={};
  try{
    if((await lstat(path)).isSymbolicLink())throw new InseqError('UNSAFE_SETTINGS','WorkBuddy 设置路径不安全');
    settings=JSON.parse(await readFile(path,'utf8'));
  }catch(e){if(e.code!=='ENOENT')throw e;}
  if(!settings||typeof settings!=='object'||Array.isArray(settings))throw new InseqError('INVALID_SETTINGS','无法读取 WorkBuddy 设置');
  settings.hooks??={};
  if(Array.isArray(settings.hooks)||typeof settings.hooks!=='object')throw new InseqError('INVALID_SETTINGS','无法读取 WorkBuddy 回调设置');
  for(const event of ['PreToolUse','PostToolUse']){
    const existing=settings.hooks[event]||[];
    if(!Array.isArray(existing))throw new InseqError('INVALID_SETTINGS','无法读取 WorkBuddy 回调设置');
    // Only replace our previous entry; retain every user/other-connector hook.
    settings.hooks[event]=existing.filter(row=>!row.hooks?.some(h=>h.command?.endsWith(' _workbuddy_video_hook')));
    settings.hooks[event].push({matcher:'^AskUserQuestion$',hooks:[{type:'command',command:hookCommand(),timeout:55}]});
  }
  await mkdir(root,{recursive:true,mode:0o700});
  const temp=path+'.inseq-'+randomUUID();
  await writeFile(temp,JSON.stringify(settings,null,2)+'\n',{flag:'wx',mode:0o600});
  await rename(temp,path);
  return {ready:true,video_confirmation:'workbuddy_question'};
}

// The callback entrypoint is for the host-spawned hook, never a model command.
// Local runtime/OS credentials are trusted; this is not remote host attestation.
export async function assertWorkbuddyHookParent(){
  const inspect=async pid=>{
    if(process.platform==='win32'){
      const {stdout}=await run('powershell.exe',['-NoProfile','-NonInteractive','-Command',
        `Get-CimInstance Win32_Process -Filter "ProcessId = ${Number(pid)}" | Select-Object ParentProcessId,CommandLine | ConvertTo-Json -Compress`],{timeout:3000});
      const p=JSON.parse(stdout);return {parent:p.ParentProcessId,args:p.CommandLine||''};
    }
    const {stdout}=await run('/bin/ps',['-p',String(pid),'-o','ppid=','-o','args='],{timeout:3000});
    const m=stdout.trim().match(/^(\d+)\s+([\s\S]+)$/);return {parent:Number(m?.[1]),args:m?.[2]||''};
  };
  let p=await inspect(process.ppid);
  // Host command hooks may have one shell wrapper; a persistent tool terminal,
  // another Node script, or an arbitrary stdin invocation is not a hook caller.
  if(p.args.includes(' _workbuddy_video_hook')&&p.args.includes(script))p=await inspect(p.parent);
  if(!/(?:WorkBuddy[.]app[\/\\]|[\/\\]WorkBuddy[\/\\]|[\/\\]workbuddy[\/\\])/i.test(p.args)
      ||!/(?:codebuddy-lite-wb[.]mjs|codebuddy[.]js)/.test(p.args)){
    throw new InseqError('HOST_CALLBACK_REQUIRED','仅接受 WorkBuddy 原生提问回调');
  }
}

export async function prepareWorkbuddy(client,project,request,sessionId=process.env.CODEBUDDY_SESSION_ID,signal){
  const key=keyFor(sessionId);
  const pending=await prepareVideo(client,project,request,sessionId,signal);
  if(pending.state!=='pending')return pending;
  const question=workbuddyQuestion(pending.quote);
  await client.store.set(key,{...pending,question,phase:'waiting'});
  return {state:'awaiting_user_confirmation',request_id:request,
    tool:'AskUserQuestion',arguments:{questions:[question]},
    next:'使用以上完整参数调用 WorkBuddy 原生 AskUserQuestion；不要填写 answers。用户选择后由 INSEQ 回调提交，随后只查询原任务。'};
}

const sameQuestion=(input,pending)=>input?.questions?.length===1&&
  input.questions[0].question===pending.question.question&&
  input.questions[0].header===pending.question.header&&
  input.questions[0].multiSelect!==true&&
  input.questions[0].options?.length===2&&input.questions[0].options.every((o,i)=>
    o.label===pending.question.options[i].label&&o.description===pending.question.options[i].description);
const deny=reason=>({hookSpecificOutput:{hookEventName:'PreToolUse',permissionDecision:'deny',permissionDecisionReason:reason}});

export async function handleWorkbuddyHook(client,event,signal){
  if(event.tool_name!=='AskUserQuestion'||!['PreToolUse','PostToolUse'].includes(event.hook_event_name))return {};
  const key=keyFor(event.session_id),call=event.tool_use_id||event.call_id;
  if(typeof call!=='string'||!call)return {};
  return client.store.exclusive(async()=>{
    const pending=await client.store.get(key);
    if(!pending||pending.session_id!==event.session_id)return {};
    const input=event.tool_input;
    // Only the current complete quotation can prime a human answer. Model-
    // supplied answers never reach the host's approval component for this quote.
    const relevant=input?.questions?.some(q=>q.question?.includes(pending.request_id));
    if(!relevant)return {};
    if(event.hook_event_name==='PreToolUse'){
      if(!sameQuestion(input,pending)||input.answers!==undefined)return deny('请使用 INSEQ 返回的完整报价提问，不要预填答案。');
      if(pending.phase!=='waiting'||pending.quote.expires_at*1000<=Date.now())return deny('此报价已结束或过期，请查询原任务或重新报价。');
      await client.store.set(key,{...pending,call_id:call,phase:'asking'});
      return {}; // Never auto-allow: WorkBuddy must collect its native user answer.
    }
    if(pending.phase!=='asking'||pending.call_id!==call||!sameQuestion(input,pending))return {};
    const result=event.tool_response;
    const content=typeof result==='string'?result:typeof result?.content==='string'?result.content:
      Array.isArray(result?.content)?result.content.filter(x=>x.type==='text').map(x=>x.text).join('\n'):'';
    // WorkBuddy's question tool returns “ · <question> → <answer>”. Do not
    // inspect arbitrary user/assistant prose or parse general assent.
    const tail=content.trim().slice(('· '+pending.question.question).length).trim();
    const choice=content.trim().startsWith('· '+pending.question.question)&&/^→\s*/u.test(tail)?tail.replace(/^→\s*/u,''):null;
    if(result?.is_error||result?.isError||![APPROVE,DECLINE].includes(choice)){
      await client.store.set(key,{...pending,phase:'not_confirmed'});return {};
    }
    await client.store.set(key,{...pending,phase:'sending'});
    try{
      // Refresh can happen without prompting; no interactive login inside a hook.
      const saved=await client.store.get('session');
      if(!saved)throw new InseqError('AUTHENTICATION_REQUIRED','请先重新连接 INSEQ');
      const receipt=await decideVideo(client,pending,choice===APPROVE?'allow':'deny',call,signal);
      await client.store.set(key,{...pending,phase:'completed',result:receipt});
      return {hookSpecificOutput:{hookEventName:'PostToolUse',additionalContext:JSON.stringify({inseq_video:receipt,
        next:'查询原任务并在当前对话交付；不要新建请求或再次提交。'})}};
    }catch(e){
      return {hookSpecificOutput:{hookEventName:'PostToolUse',additionalContext:JSON.stringify({
        request_id:pending.request_id,error:e instanceof InseqError?e.toJSON():{error:'CONFIRMATION_FAILED'},
        next:'查询原任务状态，不能换编号重提；重新登录后须重新确认本次报价。'})}};
    }
  },signal,'video-confirmation');
}
