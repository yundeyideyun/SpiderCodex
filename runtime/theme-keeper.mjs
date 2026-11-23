import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {addLoadingPreview,inClientDocument,isClientPage} from './target-scope.mjs';
import {themeConfig} from './theme-artwork.mjs';
const dir=path.dirname(fileURLToPath(import.meta.url)),root=path.dirname(dir);
const arg=(n,d)=>{const i=process.argv.indexOf(n);return i<0?d:process.argv[i+1]};
const port=Number(arg('--port','9341')),owner=Number(arg('--owner','0')),suffix=arg('--suffix','');
if(!Number.isInteger(port)||port<1024||port>65535||!Number.isInteger(owner)||owner<=0||!['','.qa'].includes(suffix))throw Error('Invalid local keeper ownership');
const state=path.join(process.env.LOCALAPPDATA,'SpiderCodex'),disabledFile=path.join(state,`theme-disabled-${port}.json`),metaFile=path.join(state,`keeper-${port}.json`),sessions=new Map();
const exists=p=>fs.access(p).then(()=>true,()=>false),delay=n=>new Promise(r=>setTimeout(r,n));
let revision='',artStamp='',payloadToken=0,expression='',bootstrap='',version=0,missing=0,boundClient=null;
let transitionThrough=0;
// The brand-neutral cover is small enough to install as soon as a replacement
// app document appears, before sending or decoding the full wallpaper.
const loadingPreview=`(${addLoadingPreview.toString()})()`;
async function payload(){
 const source=await fs.readFile(path.join(dir,'spider-theme.js'),'utf8'),mark=source.match(/VERSION=(\d+)/)?.[1];
 const artFile=path.join(root,'assets','client-brighter.png');
 const info=await fs.stat(artFile);
 const nextArtStamp=JSON.stringify([info.size,info.mtimeMs,info.ctimeMs,info.ino]);
 if(source===revision&&nextArtStamp===artStamp)return;
 // A temporarily unavailable asset must leave the previous payload intact so
 // the next pass retries this same source revision.
 const nextVersion=Number(mark);
 if(!Number.isSafeInteger(nextVersion)||nextVersion<=0)throw Error('Theme revision missing');
 const art=await fs.readFile(artFile);
 const nextExpression=`${source}(${JSON.stringify(await themeConfig(root,art))})`;
 revision=source;artStamp=nextArtStamp;payloadToken++;version=nextVersion;expression=nextExpression;
 bootstrap=`(()=>{${loadingPreview};window.__SPIDER_DOCUMENT_BOOTSTRAP__?.stop();let observer,stopped=false;const stop=()=>{stopped=true;observer?.disconnect();removeEventListener('DOMContentLoaded',start)};const apply=()=>{if(stopped||window.__SPIDER_THEME_DISABLED__)return;try{const result=${expression};if(result?.version===${version})stop();}catch{}};const start=()=>{if(stopped)return;observer=new MutationObserver(apply);observer.observe(document.documentElement,{childList:true,subtree:true,characterData:true});apply()};window.__SPIDER_DOCUMENT_BOOTSTRAP__={stop};if(document.readyState==='loading')addEventListener('DOMContentLoaded',start,{once:true});else start();})();`;
 for(const s of sessions.values())s.registeredVersion=0;
}
async function connection(target){const u=new URL(target.webSocketDebuggerUrl);if(!['127.0.0.1','localhost','[::1]'].includes(u.hostname)||Number(u.port)!==port)throw Error('Nonlocal page endpoint');const ws=new WebSocket(u),pending=new Map();let next=0;await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Page connection timeout')),2000);ws.onopen=()=>{clearTimeout(timer);resolve()};ws.onerror=()=>{clearTimeout(timer);reject(Error('Page connection failed'))}});const s={id:target.id,ws,registeredVersion:0,identifier:null,closed:false};
 const fail=()=>{s.closed=true;for(const task of pending.values()){clearTimeout(task.timer);task.reject(Error('Page connection closed'))}pending.clear()};ws.onclose=fail;ws.onerror=fail;ws.onmessage=({data})=>{const x=JSON.parse(data),task=pending.get(x.id);if(!task)return;pending.delete(x.id);clearTimeout(task.timer);x.error?task.reject(Error(x.error.message)):task.resolve(x.result)};
 s.call=(method,params={},timeout=4000)=>new Promise((resolve,reject)=>{
  if(s.closed||ws.readyState!==WebSocket.OPEN){reject(Error('Page connection closed'));return;}
  const id=++next,timer=setTimeout(()=>{pending.delete(id);reject(Error('Page command timeout'))},timeout);
  pending.set(id,{resolve,reject,timer});
  try{ws.send(JSON.stringify({id,method,params}));}
  catch(error){clearTimeout(timer);pending.delete(id);reject(error);}
 });
 s.evaluate=async(source,timeout)=>{
  const r=await s.call('Runtime.evaluate',{expression:inClientDocument(source),returnByValue:true,awaitPromise:true},timeout);
  if(r.exceptionDetails)throw Error('Page evaluation failed');return r.result?.value;
 };
 await s.evaluate(loadingPreview,800).catch(()=>{});
 await s.call('Page.enable');return s;
}
async function close(s,disabled=false){
 try{
  if(disabled)await s.evaluate('(()=>{window.__SPIDER_THEME_DISABLED__=true;window.__SPIDER_DOCUMENT_BOOTSTRAP__?.stop();window.__SPIDER_CODEX_V3__?.remove();window.__SPIDER_CODEX_V2__?.remove();document.getElementById("spider-codex-loading-preview")?.remove();return true})()');
  if(s.identifier)await s.call('Page.removeScriptToEvaluateOnNewDocument',{identifier:s.identifier});
 }catch{}
 s.ws.close();
}
// Observe only public UI state. No URL, account name or authentication value is retained.
function loginReturn(previous,phase,now){
 const windowMs=5*60*1000;
 if(phase==='waiting')return previous.waitingAt?previous:{waitingAt:now,completedAt:previous.completedAt||0};
 if(phase==='login')return {waitingAt:0,completedAt:previous.completedAt||0};
 if(phase==='workspace'&&previous.waitingAt&&now-previous.waitingAt<=windowMs)
  return {waitingAt:0,completedAt:now};
 if(phase==='workspace'&&previous.waitingAt)return {waitingAt:0,completedAt:previous.completedAt||0};
 return previous;
}
const loginPhase=`(() => {
 const h=window.__SPIDER_CODEX_V3__?.diagnose();
 if(h?.active&&h.surface==='workspace'&&h.composer)return 'workspace';
 if(h?.surface!=='login')return null;
 const browserWait=/^(取消登录|复制登录链接|Cancel login|Cancel sign-in|Copy login link)$/i;
 return [...document.querySelectorAll('button')].some(b=>b.checkVisibility()&&[b.getAttribute('aria-label'),b.textContent].some(label=>browserWait.test(label?.trim()||'')))?'waiting':'login';
})()`;
let lastMetadata='',lastMetadataWrite=0;
async function metadata(disabled,status='running'){
 const targets=[...sessions.values()].filter(s=>!s.closed).map(s=>({id:s.id,registered:s.registeredVersion===version}));
 const snapshot={owner,pid:process.pid,version,status,disabled,targets};
 const candidates=[...sessions.values()].filter(s=>!s.closed);
 const loginCompletedAt=!disabled&&candidates.length===1?candidates[0].loginReturn?.completedAt:0;
 if(loginCompletedAt)snapshot.loginCompletedAt=loginCompletedAt;
 const fingerprint=JSON.stringify(snapshot);
 if(fingerprint===lastMetadata&&Date.now()-lastMetadataWrite<5000)return;
 const temporary=metaFile+'.'+process.pid+'.tmp';
 try{
  await fs.writeFile(temporary,JSON.stringify({...snapshot,at:new Date().toISOString()}));
  await fs.rename(temporary,metaFile);
 }finally{await fs.unlink(temporary).catch(()=>{});}
 lastMetadata=fingerprint;
 lastMetadataWrite=Date.now();
}
async function binding(){
 const record=JSON.parse(await fs.readFile(path.join(state,'attachment'+suffix+'.json'),'utf8'));
 if(record.monitorPid!==owner||record.port!==port||!Number.isInteger(record.clientPid)||record.clientPid<=0||
     !Number.isFinite(record.createdTicks)||record.createdTicks<=0)return false;
 if(boundClient&&(boundClient.clientPid!==record.clientPid||boundClient.createdTicks!==record.createdTicks))return false;
 try{process.kill(record.clientPid,0);}catch{return false;}
 boundClient=record;
 return true;
}
try{while(true){
 try{const ownerState=JSON.parse(await fs.readFile(path.join(state,'session'+suffix+'.json'),'utf8'));if(ownerState.pid!==owner||!['starting','visible'].includes(ownerState.status))break;process.kill(owner,0);
  if(!await binding())break;
  const disabled=await exists(disabledFile);
  if(disabled){for(const s of sessions.values())await close(s,true);sessions.clear();await metadata(true);}
  else{await payload();const list=await fetch(`http://127.0.0.1:${port}/json/list`,{signal:AbortSignal.timeout(1800)}).then(r=>r.json());if(!await binding())break;const pages=list.filter(isClientPage);const ids=new Set(pages.map(t=>t.id));
   for(const [id,s] of sessions)if(s.closed||!ids.has(id)){sessions.delete(id);void close(s)}
   for(const target of pages){try{let s=sessions.get(target.id);if(!s){s=await connection(target);sessions.set(target.id,s)}
    if(s.registeredVersion!==version){if(s.identifier)await s.call('Page.removeScriptToEvaluateOnNewDocument',{identifier:s.identifier}).catch(()=>{});s.identifier=(await s.call('Page.addScriptToEvaluateOnNewDocument',{source:inClientDocument(bootstrap)})).identifier;s.registeredVersion=version;}
    const installed=await s.evaluate('(()=>{const h=window.__SPIDER_CODEX_V3__;return h?.healthy?.()?h.diagnose():null})()',s.loading?220:2200);
    s.loading=installed?.surface==='loading';
    if(s.loading)transitionThrough=Date.now()+6500;
    else if(installed?.active&&installed.surface==='workspace')transitionThrough=0;
    if(pages.length!==1)s.loginReturn=null;
    else s.loginReturn=loginReturn(s.loginReturn??{waitingAt:0,completedAt:0},
     installed?.surface==='login'?await s.evaluate(loginPhase):installed?.active&&installed.surface==='workspace'&&installed.composer?'workspace':null,Date.now());
    if((s.appliedPayloadToken!==payloadToken||!installed||installed.version!==version||(!installed.active&&['login','workspace-picker'].includes(installed.surface)))&&!await exists(disabledFile)){
     await s.evaluate(`(()=>{window.__SPIDER_THEME_DISABLED__=false;return (${expression});})()`);
     s.appliedPayloadToken=payloadToken;
    }
   }catch{const s=sessions.get(target.id);if(s){sessions.delete(target.id);void close(s)}}}
   await metadata(false);missing=0;
  }
 }catch{if(++missing>=12)break;}
 await delay(Date.now()<transitionThrough?110:500);
}}finally{for(const s of sessions.values())await close(s);sessions.clear();await metadata(await exists(disabledFile),'closed').catch(()=>{});}
