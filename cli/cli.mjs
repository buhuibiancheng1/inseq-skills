#!/usr/bin/env node
import {readFile} from 'node:fs/promises';
import {Client, InseqError} from './client.mjs';
import {installWorkbuddyHooks,prepareWorkbuddy,handleWorkbuddyHook,assertWorkbuddyHookParent} from './workbuddy-confirmation.mjs';

const args=process.argv.slice(2);
const take=(key,fallback)=>{const i=args.indexOf(key);return i<0?fallback:args.splice(i,2)[1];};
const host=take('--host','workbuddy');
const input=take('--input',null);
const device=host==='workbuddy'||args.includes('--device');
if(args.includes('--device'))args.splice(args.indexOf('--device'),1);
const openDeviceBrowser=!args.includes('--no-browser');
if(args.includes('--no-browser'))args.splice(args.indexOf('--no-browser'),1);
const controller=new AbortController();
process.on('SIGINT',()=>controller.abort());process.on('SIGTERM',()=>controller.abort());
const hook=args[0]==='_workbuddy_video_hook';
const client=new Client({host,device,openDeviceBrowser,deferDevice:hook,notify:flow=>{
  // WorkBuddy reads the authorization URL from stdout; never print token replies.
  if(hook)return;
  process.stdout.write(flow.url+'\n');
  if(flow.user_code)process.stdout.write('连接码 '+flow.user_code+'\n');
}});
try{
  let result;
  if(args[0]==='--version') result={version:'0.5.1'};
  else if(args[0]==='init') result=host==='workbuddy'?await installWorkbuddyHooks():{ready:true,version:'0.5.1'};
  else if(hook){
    await assertWorkbuddyHookParent();
    let json='';for await(const chunk of process.stdin){json+=chunk;if(json.length>1000000)throw new Error('Hook too large');}
    result=await handleWorkbuddyHook(client,JSON.parse(json),controller.signal);
  }
  else if(args[0]==='video'&&args[1]==='confirm')result=await prepareWorkbuddy(client,take('--project'),take('--request'),process.env.CODEBUDDY_SESSION_ID,controller.signal);
  else if(args[0]==='auth'&&args[1]==='login'){await client.login(controller.signal);result={authenticated:true};}
  else if(args[0]==='auth'&&args[1]==='status'){result=await client.status(controller.signal);if(!result.authenticated)process.exitCode=1;}
  else if(args[0]==='auth'&&args[1]==='logout')result=await client.logout(controller.signal);
  else if(args[0]==='tools')result=await client.catalog(controller.signal);
  else if(args[0]==='call'){
    let json=args[2]||'{}';
    if(input==='-'){json='';for await(const chunk of process.stdin)json+=chunk;}
    else if(input)json=await readFile(input,'utf8');
    result=await client.call(args[1],JSON.parse(json),controller.signal);
  }
  else if(args[0]==='resume')result=await client.resume(args[1],controller.signal);
  else result={usage:['inseq auth login','inseq auth status','inseq auth logout','inseq tools','inseq call <tool> --input <json-file>','inseq resume <continuation_id>'],host};
  process.stdout.write(JSON.stringify(result)+'\n');
}catch(e){process.stderr.write(JSON.stringify(e instanceof InseqError?e.toJSON():{error:'FAILED',message:'操作未完成，请检查输入或连接状态'})+'\n');process.exitCode=1;}
