import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {Client, InseqError} from './client.mjs';

export const name = 'inseq';
export const inject = ['tools', 'skills', 'credentials'];

// DSH's credential provider stores secrets outside plugin configuration and tool results.
class HarnessStore {
  constructor(credentials) { this.credentials=credentials; this.queue=Promise.resolve(); }
  key(key) { if(!/^[a-z0-9-]+$/.test(key)) throw new Error('Invalid storage key'); return 'inseq/'+key; }
  async get(key) { return (await this.credentials.readRecord(this.key(key)))?.payload; }
  async set(key,value) { await this.credentials.modifyRecord(this.key(key),()=>({kind:'grant',payload:value})); }
  async delete(key) { await this.credentials.deleteRecord(this.key(key)); }
  async exclusive(work,signal) {
    const previous=this.queue;let release;this.queue=new Promise(resolve=>{release=resolve;});
    await previous;
    try {signal?.throwIfAborted();return await work();} finally {release();}
  }
}

export async function apply(ctx) {
  const client=new Client({host:'deepseek-harness',store:new HarnessStore(ctx.credentials),deferDevice:true});
  const skillPath=fileURLToPath(new URL('./skills/inseq/',import.meta.url));
  const source=await readFile(new URL('./skills/inseq/SKILL.md',import.meta.url),'utf8');
  ctx.effect(()=>ctx.skills.register({name:'inseq',description:'使用 INSEQ 提取视频文案、分析账号、研究选题、创作并保存成果。',
    content:source.replace(/^---\n[\s\S]*?\n---\n/,''),source:'bundled',path:skillPath+'SKILL.md',resourceBase:{kind:'directory',path:skillPath}}));
  ctx.effect(()=>ctx.tools.register({name:'inseq',description:'连接 INSEQ、读取公开工具定义、调用技能服务和保存成果。首次调用自动登录并继续。',
    parameters:{action:{type:'string',required:true,enum:['tools','call','resume','status','logout']},
      tool:{type:'string',description:'call 时使用 tools 返回的准确工具名'},
      arguments_json:{type:'string',description:'call 时按照工具 schema 提供 JSON 对象'},
      continuation_id:{type:'string',description:'resume 时使用原回执编号'}},
    output:{schema:{type:'object',additionalProperties:true},render:(_args,value)=>[{type:'text',text:JSON.stringify(value)}]},
    timeoutMs:660000,
    async execute(args,exec){
      try{
        if(args.action==='tools')return await client.catalog(exec.signal);
        if(args.action==='status')return await client.status(exec.signal);
        if(args.action==='logout')return await client.logout(exec.signal);
        if(args.action==='resume')return await client.resume(args.continuation_id,exec.signal);
        if(args.action==='call')return await client.call(args.tool,JSON.parse(args.arguments_json||'{}'),exec.signal);
        throw new InseqError('INVALID_ACTION','操作无效');
      }catch(e){return e instanceof InseqError?e.toJSON():{error:'FAILED',message:'操作未完成，请检查参数或连接状态'};}
    },
    presentCall:args=>({card:'generic',title:'INSEQ',kind:['tools','status'].includes(args.action)?'read':'other'})
  }));
}
