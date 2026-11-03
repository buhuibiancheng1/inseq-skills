import {readFile} from 'node:fs/promises';
import {InseqError} from './client.mjs';

export async function callInput(input, positional, stdin=process.stdin) {
  let json=positional||'{}';
  if(input==='-') {
    json='';
    for await(const chunk of stdin) json+=chunk;
  } else if(input) {
    if(/^[\s]*[\[{]/.test(input)) json=input;
    else {
      try { json=await readFile(input,'utf8'); }
      catch { throw new InseqError('INPUT_FILE_UNREADABLE','无法读取参数文件；--input 可传 JSON 文件路径、JSON 对象或 -（标准输入）'); }
    }
  }
  let value;
  try { value=JSON.parse(json); }
  catch { throw new InseqError('INVALID_JSON','参数不是有效 JSON；请检查参数文件或 JSON 对象格式'); }
  if(!value||typeof value!=='object'||Array.isArray(value)) throw new InseqError('INVALID_ARGUMENTS','工具参数必须是 JSON 对象');
  return value;
}
