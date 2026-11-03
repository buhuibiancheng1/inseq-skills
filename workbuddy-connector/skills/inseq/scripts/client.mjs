import {randomBytes, randomUUID, createHash, timingSafeEqual} from 'node:crypto';
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {mkdir, readFile, writeFile, rename, unlink, lstat, chmod} from 'node:fs/promises';
import {homedir} from 'node:os';
import {join} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';

export const ORIGIN = 'https://inseq.zhujunyue.com';
const HOSTS = {'deepseek-harness': 'DeepSeek Harness', workbuddy: 'WorkBuddy'};
const READ_ONLY = new Set(['inseq_search_skills','inseq_get_skill','inseq_capabilities','inseq_list_projects','inseq_list_items','inseq_get_item','inseq_get_asset','inseq_get_transcript','inseq_get_task','inseq_credits','inseq_text_metrics','inseq_video_quotes','inseq_media_operations','inseq_preview_results','inseq_test_ui']);

export class InseqError extends Error {
  constructor(code, message, detail = {}) { super(message); this.code = code; this.detail = detail; }
  toJSON() { return {error: this.code, message: this.message, ...this.detail}; }
}

// WorkBuddy owns its Node installation; INSEQ owns only this private session directory.
export class FileStore {
  constructor(host, root = join(homedir(), '.config', 'inseq', host)) { this.root = root; }
  async prepare() {
    await mkdir(this.root, {recursive: true, mode: 0o700});
    const info = await lstat(this.root);
    if (!info.isDirectory() || info.isSymbolicLink()) throw new InseqError('UNSAFE_STORAGE', '会话目录不安全');
    await chmod(this.root, 0o700);
  }
  path(key) {
    if (!/^[a-z0-9-]+$/.test(key)) throw new Error('Invalid store key');
    return join(this.root, key + '.json');
  }
  async get(key) {
    try {
      const path = this.path(key), info = await lstat(path);
      if (!info.isFile() || info.isSymbolicLink() || (process.platform !== 'win32' && (info.mode & 0o077))) throw new InseqError('UNSAFE_STORAGE', '会话文件权限不安全');
      return JSON.parse(await readFile(path, 'utf8'));
    } catch (e) { if (e.code === 'ENOENT') return undefined; throw e; }
  }
  async set(key, value) {
    await this.prepare();
    const target = this.path(key), temp = target + '.' + randomUUID();
    await writeFile(temp, JSON.stringify(value), {mode: 0o600, flag: 'wx'});
    await rename(temp, target);
  }
  async delete(key) { await unlink(this.path(key)).catch(e => { if (e.code !== 'ENOENT') throw e; }); }
  async exclusive(work, signal) {
    await this.prepare();
    const path = join(this.root, 'auth.lock');
    for (let i = 0; ; i++) {
      signal?.throwIfAborted();
      try { await writeFile(path, JSON.stringify({pid: process.pid}), {flag: 'wx', mode: 0o600}); break; }
      catch (e) {
        if (e.code !== 'EEXIST') throw e;
        // Recover a dead owner only; never steal a live authorization or refresh.
        try {
          const owner = JSON.parse(await readFile(path, 'utf8'));
          if (Number.isSafeInteger(owner.pid) && owner.pid > 0) {
            try { process.kill(owner.pid, 0); }
            catch (p) { if (p.code === 'ESRCH') { await unlink(path).catch(()=>{}); continue; } }
          }
        } catch {}
        if (i >= 3600) throw new InseqError('AUTH_BUSY', '另一条连接操作尚未结束，请稍后重试');
        await delay(200, undefined, {signal});
      }
    }
    try { return await work(); } finally { await unlink(path).catch(()=>{}); }
  }
}

export async function openBrowser(url) {
  const command = process.platform === 'darwin' ? ['open', [url]] : process.platform === 'win32'
    ? ['rundll32.exe', ['url.dll,FileProtocolHandler', url]] : ['xdg-open', [url]];
  await new Promise((resolve, reject) => {
    const child = spawn(command[0], command[1], {stdio: 'ignore', shell: false});
    child.on('error', reject); child.on('close', code => code === 0 ? resolve() : reject(new Error('Browser unavailable')));
  });
}

export class Client {
  constructor({host, store, origin = ORIGIN, fetchImpl = fetch, browser = openBrowser, notify = ()=>{}, device = false, deferDevice = false, openDeviceBrowser = true} = {}) {
    if (!HOSTS[host]) throw new Error('Unsupported host');
    const u = new URL(origin);
    if (u.origin !== origin || (origin !== ORIGIN && !(u.protocol === 'http:' && u.hostname === '127.0.0.1'))) throw new Error('Invalid INSEQ origin');
    Object.assign(this, {host, store: store || new FileStore(host), origin, fetch: fetchImpl, browser, notify, device, deferDevice, openDeviceBrowser});
    this.clientId = 'inseq-' + host;
    this.resource = origin + '/mcp';
  }
  async request(path, {method = 'GET', body, token, signal, form = false, timeout = 45000} = {}) {
    const headers = {Accept: 'application/json'};
    if (token) headers.Authorization = 'Bearer ' + token;
    if (body !== undefined) headers['Content-Type'] = form ? 'application/x-www-form-urlencoded' : 'application/json';
    let response;
    try {
      response = await this.fetch(this.origin + path, {method, headers, redirect: 'error',
        body: body === undefined ? undefined : form ? new URLSearchParams(body).toString() : JSON.stringify(body),
        signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(timeout)]) : AbortSignal.timeout(timeout)});
    } catch { signal?.throwIfAborted(); throw new InseqError('CONNECTION_FAILED', 'INSEQ 连接中断，请查询原任务状态'); }
    let data;
    try { data = await response.json(); } catch { throw new InseqError('INVALID_RESPONSE', 'INSEQ 返回内容无法读取'); }
    return {status: response.status, data};
  }
  async saveTokens(data) {
    if (typeof data.access_token !== 'string' || !Number.isFinite(data.expires_in) || data.expires_in <= 0) throw new InseqError('INVALID_AUTH', '登录回执不完整');
    await this.store.set('session', {access_token: data.access_token, refresh_token: data.refresh_token,
      expires_at: Date.now() + data.expires_in * 1000, client_id: this.clientId, origin: this.origin});
  }
  async status(signal) {
    const session = await this.store.get('session');
    if (!session || session.origin !== this.origin || session.client_id !== this.clientId || session.expires_at <= Date.now()) return {authenticated: false};
    const response = await this.request('/agent/session', {token: session.access_token, signal, timeout: 7000});
    if (response.status === 401) return {authenticated: false};
    if (response.status !== 200) throw new InseqError('STATUS_UNAVAILABLE', '暂时无法检查连接');
    return response.data;
  }
  async login(signal, force = false) {
    return this.store.exclusive(async () => {
      let saved = await this.store.get('session');
      if (saved && saved.origin === this.origin && saved.client_id === this.clientId && !force) {
        if (saved.expires_at > Date.now() + 30000) return saved;
        if (saved.refresh_token) {
          const response = await this.request('/oauth/token', {method:'POST', form:true, signal, body:{
            grant_type:'refresh_token', client_id:this.clientId, refresh_token:saved.refresh_token, resource:this.resource}});
          if (response.status === 200) { await this.saveTokens(response.data); return await this.store.get('session'); }
          if (response.data.error !== 'invalid_grant') throw new InseqError('AUTH_UNAVAILABLE', '暂时无法更新登录，请稍后重试');
        }
      }
      await this.store.delete('session');
      const pendingDevice = await this.store.get('device');
      if (this.device || pendingDevice || process.env.SSH_CONNECTION || (process.platform === 'linux' && !process.env.DISPLAY && !process.env.WAYLAND_DISPLAY)) {
        await this.deviceLogin(signal);
      } else {
        try { await this.loopbackLogin(signal); }
        catch (e) { if (e.code !== 'BROWSER_UNAVAILABLE') throw e; await this.deviceLogin(signal); }
      }
      return await this.store.get('session');
    }, signal);
  }
  async deviceLogin(signal) {
    let flow = await this.store.get('device');
    if (!flow || flow.expires_at <= Date.now() || flow.origin !== this.origin) {
      const response = await this.request('/oauth/device_authorization', {method:'POST', form:true, signal,
        body:{client_id:this.clientId, scope:'inseq', resource:this.resource}});
      if (response.status !== 200) throw new InseqError('LOGIN_UNAVAILABLE', '无法发起网页登录');
      flow = {...response.data, origin:this.origin, expires_at: Date.now() + response.data.expires_in * 1000};
      if (!flow.verification_uri_complete?.startsWith(this.origin + '/oauth/device?')) throw new InseqError('INVALID_AUTH', '登录地址无效');
      await this.store.set('device', flow);
      this.notify({url:flow.verification_uri_complete, user_code:flow.user_code});
      if (this.deferDevice) throw new InseqError('AUTHENTICATION_REQUIRED', '请在浏览器授权后继续原任务', {url:flow.verification_uri_complete, user_code:flow.user_code});
      if (this.openDeviceBrowser && !process.env.SSH_CONNECTION && !(process.platform === 'linux' && !process.env.DISPLAY && !process.env.WAYLAND_DISPLAY)) await this.browser(flow.verification_uri_complete).catch(()=>{});
    }
    let interval = Math.max(5, flow.interval);
    while (Date.now() < flow.expires_at) {
      await delay(interval * 1000, undefined, {signal});
      const response = await this.request('/oauth/token', {method:'POST', form:true, signal, body:{
        grant_type:'urn:ietf:params:oauth:grant-type:device_code', client_id:this.clientId,
        device_code:flow.device_code, resource:this.resource}});
      if (response.status === 200) { await this.saveTokens(response.data); await this.store.delete('device'); return; }
      if (response.data.error === 'slow_down') interval += 5;
      else if (response.data.error !== 'authorization_pending') { await this.store.delete('device'); throw new InseqError('AUTHORIZATION_DECLINED', '登录未完成或已取消，请重新连接'); }
    }
    await this.store.delete('device');
    throw new InseqError('AUTHORIZATION_EXPIRED', '登录已超时，请重新连接');
  }
  async loopbackLogin(signal) {
    const verifier = randomBytes(48).toString('base64url'), state = randomBytes(32).toString('base64url');
    const callbackPath = '/api/platform/browser-login/callback';
    let resolveCode, rejectCode;
    const codePromise = new Promise((resolve, reject)=>{ resolveCode=resolve; rejectCode=reject; });
    // Attach immediately so an early cancellation is handled while opening the browser.
    codePromise.catch(()=>{});
    const server = createServer((req,res)=>{
      const u = new URL(req.url, 'http://127.0.0.1');
      const candidate = Buffer.from(u.searchParams.get('state') || '');
      if (req.method !== 'GET' || u.pathname !== callbackPath || candidate.length !== state.length || !timingSafeEqual(candidate,Buffer.from(state))) {
        res.writeHead(400, {'Content-Type':'text/plain; charset=utf-8'}); res.end('连接请求无效'); return;
      }
      const iss = u.searchParams.get('iss');
      if (iss !== this.origin || u.searchParams.getAll('code').length > 1 || u.searchParams.getAll('state').length !== 1) {
        res.writeHead(400); res.end('Invalid authorization response'); rejectCode(new InseqError('INVALID_AUTH','授权回执无效')); return;
      }
      res.writeHead(200, {'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'});
      if (u.searchParams.has('error')) { res.end('连接已取消，请返回原 Agent'); rejectCode(new InseqError('AUTHORIZATION_DECLINED','用户已取消连接')); }
      else if (u.searchParams.get('code')) { res.end('已连接，请返回原 Agent。'); resolveCode(u.searchParams.get('code')); }
      else { res.end('连接未完成'); rejectCode(new InseqError('INVALID_AUTH','缺少授权回执')); }
    });
    await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
    const redirect = `http://127.0.0.1:${server.address().port}${callbackPath}`;
    const url = this.origin + '/oauth/authorize?' + new URLSearchParams({client_id:this.clientId, response_type:'code', redirect_uri:redirect,
      scope:'inseq',resource:this.resource,state,code_challenge:createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'S256'});
    const timer = setTimeout(()=>rejectCode(new InseqError('AUTHORIZATION_EXPIRED','登录已超时，请重新连接')), 600000);
    const aborted = ()=>rejectCode(new InseqError('CANCELLED','登录等待已停止'));
    signal?.addEventListener('abort', aborted, {once:true});
    try {
      signal?.throwIfAborted();
      this.notify({url});
      try { await this.browser(url); } catch { throw new InseqError('BROWSER_UNAVAILABLE','无法打开本机浏览器，请改用设备授权'); }
      const code = await codePromise;
      const response = await this.request('/oauth/token', {method:'POST',form:true,signal,body:{
        grant_type:'authorization_code',client_id:this.clientId,redirect_uri:redirect,code_verifier:verifier,code,resource:this.resource}});
      if (response.status !== 200) throw new InseqError('AUTHORIZATION_FAILED','授权交换失败，请重新连接');
      await this.saveTokens(response.data);
    } finally { clearTimeout(timer);signal?.removeEventListener('abort',aborted);server.closeAllConnections();await new Promise(resolve=>server.close(resolve)); }
  }
  async authenticated(path, options = {}) {
    let saved = await this.login(options.signal);
    let response = await this.request(path, {...options, token:saved.access_token});
    // Only an explicit authentication rejection permits replay. Network errors do not.
    if (response.status === 401) {
      saved = await this.login(options.signal, true);
      if (options.accountId) {
        const identity = await this.request('/agent/session', {token:saved.access_token, signal:options.signal});
        if (identity.status !== 200 || identity.data.account_id !== options.accountId) throw new InseqError('ACCOUNT_CHANGED','当前账号与原任务不同，请切回原账号');
      }
      response = await this.request(path, {...options, token:saved.access_token});
    }
    if (response.status >= 400) throw new InseqError('API_REJECTED', typeof response.data.detail === 'string' ? response.data.detail : '请求未被接受', {status:response.status});
    return response.data;
  }
  async catalog(signal) { return this.authenticated('/agent/tools', {signal}); }
  async call(name, args = {}, signal, resumeId) {
    if (!/^inseq_[a-z_]+$/.test(name)) throw new InseqError('INVALID_TOOL','工具名称无效');
    const id = resumeId || randomUUID(), key = 'task-' + id;
    let task = resumeId ? await this.store.get(key) : {name,args,phase:'awaiting_auth',created_at:Date.now(),origin:this.origin};
    if (!task || task.name !== name || task.origin !== this.origin) throw new InseqError('TASK_NOT_FOUND','未找到原始操作');
    await this.store.set(key,task);
    try {
      const identity = await this.authenticated('/agent/session', {signal});
      if (!identity.account_id) throw new InseqError('INVALID_AUTH','账号回执不完整');
      if (task.account_id && task.account_id !== identity.account_id) throw new InseqError('ACCOUNT_CHANGED','当前账号与原任务不同，请切回原账号');
      if (task.phase === 'completed') return task.result;
      if (task.phase === 'sending' && !READ_ONLY.has(name)) throw new InseqError('RESULT_UNKNOWN','原操作结果尚未确认，请查询原任务，不能自动重新提交', {continuation_id:id, arguments:task.args});
      task.account_id=identity.account_id;
      task.phase='sending';await this.store.set(key,task);
      const result = await this.authenticated('/agent/tools/' + name,{method:'POST',body:{arguments:task.args},signal,accountId:task.account_id});
      await this.store.set(key,{...task,phase:'completed',result});
      return result;
    } catch (e) {
      if (e.code === 'AUTHENTICATION_REQUIRED' || e.code === 'AUTHORIZATION_DECLINED' || e.code === 'AUTHORIZATION_EXPIRED') {
        await this.store.set(key,{...task,phase:'awaiting_auth'});
      }
      if (e instanceof InseqError) { e.detail.continuation_id=id; throw e; }
      throw new InseqError('INTERRUPTED','操作已中断，请使用原操作编号继续或查询状态',{continuation_id:id});
    }
  }
  async resume(id, signal) {
    const task = await this.store.get('task-' + id);
    if (!task) throw new InseqError('TASK_NOT_FOUND','未找到原始操作');
    return this.call(task.name, task.args, signal, id);
  }
  async logout(signal) {
    return this.store.exclusive(async()=>{
      const session=await this.store.get('session');
      if (session?.origin === this.origin) {
        const r=await this.request('/agent/session',{method:'DELETE',token:session.access_token,signal,timeout:7000});
        if (![200,401].includes(r.status)) throw new InseqError('REVOCATION_FAILED','撤销未完成，请重试');
        // Expired access tokens still have an active refresh grant. RFC7009 is used below when available.
        if (r.status === 401 && session.refresh_token) {
          const revoke=await this.request('/oauth/revoke',{method:'POST',form:true,signal,timeout:7000,body:{token:session.refresh_token,client_id:this.clientId}});
          if (revoke.status !== 200) throw new InseqError('REVOCATION_FAILED','撤销未完成，请在账号中心撤销该连接');
        }
      }
      await this.store.delete('session');await this.store.delete('device');
      return {authenticated:false};
    },signal);
  }
}
