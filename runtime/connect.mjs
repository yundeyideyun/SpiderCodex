import {setNativeAppearance} from './native-appearance.mjs';
import {inClientDocument,isClientPage} from './target-scope.mjs';
import {themeConfig} from './theme-artwork.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const option=(name,fallback)=>{const n=process.argv.indexOf(name);return n>=0?process.argv[n+1]:fallback;};
const port=Number(option('--port','9341'));
if(!Number.isInteger(port)||port<1024||port>65535)throw Error('Invalid local port');
const targets=await fetch(`http://127.0.0.1:${port}/json/list`,{signal:AbortSignal.timeout(2000)}).then(r=>r.json()).catch(()=>null);
if(!targets){console.error('本机客户端连接尚未就绪。');process.exit(2);}
const requestedTarget=option('--target',null);
const target=targets.find(t=>isClientPage(t)&&(!requestedTarget||t.id===requestedTarget));
if(!target){console.error('尚未找到真实客户端主页面。');process.exit(3);}
const endpoint=new URL(target.webSocketDebuggerUrl);
if(!['127.0.0.1','localhost','[::1]'].includes(endpoint.hostname)||Number(endpoint.port)!==port)throw Error('Refusing non-loopback connection');
const ws=new WebSocket(endpoint.href);
await new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>{ws.close();reject(Error('WebSocket open timed out'));},2000);
  ws.onopen=()=>{clearTimeout(timer);resolve();};ws.onerror=()=>{clearTimeout(timer);reject(Error('WebSocket failed'));};
});
let id=0;const pending=new Map();
ws.onmessage=({data})=>{const p=JSON.parse(data);if(p.id&&pending.has(p.id)){const task=pending.get(p.id);pending.delete(p.id);clearTimeout(task.timer);p.error?task.reject(Error(p.error.message)):task.resolve(p.result);}};
function call(method,params={}){return new Promise((resolve,reject)=>{const n=++id;const timer=setTimeout(()=>{pending.delete(n);reject(Error(method+' timed out'));},7000);pending.set(n,{resolve,reject,timer});ws.send(JSON.stringify({id:n,method,params}));});}
async function evaluate(expression){
  const result=await call('Runtime.evaluate',{expression:inClientDocument(expression),returnByValue:true,awaitPromise:true});
  if(result.exceptionDetails)throw Error('Theme evaluation failed: '+result.exceptionDetails.text);
  return result.result?.value;
}
async function withWindow(result){return {...result,window:await evaluate('({x:screenX,y:screenY,width:outerWidth,height:outerHeight})')};}
const sidebarBackup=path.join(process.env.LOCALAPPDATA||root,'SpiderCodex',`appearance-sidebar-${port}.json`);
const disabledFile=path.join(process.env.LOCALAPPDATA||root,'SpiderCodex',`theme-disabled-${port}.json`);
const health=process.argv.includes('--health'),recover=process.argv.includes('--recover');
const themeSource=await fs.readFile(path.join(root,'runtime','spider-theme.js'),'utf8');
const themeVersion=Number(themeSource.match(/VERSION=(\d+)/)?.[1]);
if(!Number.isInteger(themeVersion)||themeVersion<=0)throw Error('Invalid theme version');
const disabled=()=>fs.access(disabledFile).then(()=>true,()=>false);
async function resizeSidebar(width){
  const initial=await evaluate(`(()=>{const aside=document.querySelector('aside.app-shell-left-panel');if(!aside)return null;const a=aside.getBoundingClientRect();if(a.width<150)return null;const handle=aside.querySelector('[role="separator"] [class*="cursor-col-resize"]');if(!handle)return null;const r=handle.getBoundingClientRect(),x=r.right-3,y=r.top+Math.min(220,r.height/2),hit=document.elementFromPoint(x,y);return {width:a.width,x,y,available:hit===handle||handle.contains(hit)}})()`);
  if(!initial)return {changed:false,reason:'sidebar-not-expanded'};
  if(Math.abs(initial.width-width)<2)return {changed:false,width:initial.width};
  if(!initial.available)return {changed:false,reason:'native-resizer-covered',width:initial.width};
  await call('Input.dispatchMouseEvent',{type:'mouseMoved',x:initial.x,y:initial.y});
  await call('Input.dispatchMouseEvent',{type:'mousePressed',x:initial.x,y:initial.y,button:'left',buttons:1,clickCount:1});
  try{for(let i=1;i<=8;i++)await call('Input.dispatchMouseEvent',{type:'mouseMoved',x:initial.x+(width-initial.width)*i/8,y:initial.y,button:'left',buttons:1});}
  finally{await call('Input.dispatchMouseEvent',{type:'mouseReleased',x:initial.x+width-initial.width,y:initial.y,button:'left',buttons:0,clickCount:1});}
  await new Promise(resolve=>setTimeout(resolve,100));
  const actual=await evaluate(`document.querySelector('aside.app-shell-left-panel')?.getBoundingClientRect().width`);
  return {changed:true,width:actual,requested:width,matched:Math.abs(actual-width)<2};
}
async function restoreSidebar(){
  const saved=await fs.readFile(sidebarBackup,'utf8').then(JSON.parse).catch(()=>null);
  if(!saved?.active||!(saved.originalWidth>=150&&saved.originalWidth<=1000)||
     !(saved.referenceWidth>=150&&saved.referenceWidth<=1000))return {changed:false,reason:'no-layout-backup'};
  const width=await evaluate(`document.querySelector('aside.app-shell-left-panel')?.getBoundingClientRect().width`);
  if(!(width>=150))return {changed:false,reason:'sidebar-not-expanded'};
  if(Math.abs(width-saved.referenceWidth)>=2||Math.abs(width-saved.originalWidth)<2){
    await fs.writeFile(sidebarBackup,JSON.stringify({...saved,active:false}));
    return {changed:false,width,reason:'existing-user-layout-preserved'};
  }
  const result=await resizeSidebar(saved.originalWidth);
  if(result.matched||Math.abs((result.width||0)-saved.originalWidth)<2)await fs.writeFile(sidebarBackup,JSON.stringify({...saved,active:false}));
  return result;
}

try {
  if(process.argv.includes('--activate')){
    const result=await evaluate(`(async()=>{if(typeof window.electronBridge?.sendMessageFromView!=='function')return {ok:false};await window.electronBridge.sendMessageFromView({type:'open-current-main-window',stealFocus:true,focusComposer:false});return {ok:true}})()`);
    // Let the native restore notification reach the renderer before reading geometry.
    await new Promise(resolve=>setTimeout(resolve,100));
    console.log(JSON.stringify(await withWindow(result)));if(!result.ok)process.exitCode=4;
  }else if(process.argv.includes('--restore')||process.argv.includes('--restore-style-only')){
    await fs.mkdir(path.dirname(disabledFile),{recursive:true});await fs.writeFile(disabledFile,JSON.stringify({disabled:true,at:new Date().toISOString()}));
    // Persistent page registrations belong to the keeper's live CDP session.
    const keeperFile=path.join(path.dirname(disabledFile),`keeper-${port}.json`);
    for(let i=0;i<20;i++){const keeper=await fs.readFile(keeperFile,'utf8').then(JSON.parse).catch(()=>null);if(!keeper||keeper.disabled||keeper.status==='closed')break;await new Promise(resolve=>setTimeout(resolve,100));}
    await evaluate('(()=>{window.__SPIDER_THEME_DISABLED__=true;window.__SPIDER_DOCUMENT_BOOTSTRAP__?.stop();document.getElementById("spider-codex-loading-preview")?.remove();return true})()');
    await evaluate('(()=>{window.__SPIDER_CODEX_V3__?.remove();window.__SPIDER_CODEX_V2__?.remove();return true;})()');
    // Unregister first: changing native appearance can reload the view.
    // A late on-new-document callback must not reinstall the just-restored theme.
    const nativeFile=path.join(process.env.LOCALAPPDATA||root,'SpiderCodex',`appearance-native-${port}.json`);
    const nativeBackup=await fs.readFile(nativeFile,'utf8').then(JSON.parse).catch(()=>null);
    const canSet=await evaluate(`!![...document.querySelectorAll('aside img,button')].find(e=>e.checkVisibility()&&(e.tagName==='IMG'||/^(外观|Appearance)$/.test(e.textContent.trim())))`);
    let nativeRestore={changed:false,pendingUntilSettingsOrExit:!!nativeBackup?.active};
    if(!process.argv.includes('--restore-style-only')&&nativeBackup?.active&&canSet){
      try{nativeRestore=await setNativeAppearance({call,evaluate},nativeBackup.original,{port,recordOriginal:false});}
      catch{nativeRestore={changed:false,pendingUntilSettingsOrExit:true,reason:'native-preference-not-restored'};}
    }
    if(!process.argv.includes('--restore-style-only')){
      const {execFile}=await import('node:child_process'),{promisify}=await import('node:util');
      for(const other of targets.filter(t=>t.id!==target.id&&isClientPage(t)))await promisify(execFile)(process.execPath,[fileURLToPath(import.meta.url),'--port',String(port),'--target',other.id,'--restore-style-only'],{windowsHide:true,timeout:12000}).catch(()=>{});
    }
    console.log(JSON.stringify({restored:true,nativeAppearance:nativeRestore,sidebar:process.argv.includes('--restore-style-only')?null:await restoreSidebar()}));
  }else if(process.argv.includes('--inspect-runtime')){
    console.log(JSON.stringify(await evaluate('({buildFlavor:window.electronBridge?.getBuildFlavor?.(),windowType:window.codexWindowType,userAgent:window.electronBridge?.getDesktopUserAgent?.()})')));
  }else if(process.argv.includes('--inspect')){
    console.log(JSON.stringify(await evaluate('window.__SPIDER_CODEX_V3__?.diagnose()||({ok:false,theme:false,main:!!document.querySelector("main[data-app-shell-main-surface]"),composer:!!document.querySelector("[data-codex-composer]")})')));
  }else{
    if((health||recover)&&await disabled()){console.log(JSON.stringify({ok:true,disabled:true}));ws.close();process.exit(0);}
    if(!health&&!recover){await fs.unlink(disabledFile).catch(()=>{});await evaluate('window.__SPIDER_THEME_DISABLED__=false');}
    const existing=await evaluate('window.__SPIDER_CODEX_V3__?.diagnose()||null');
    if(health&&existing?.version===themeVersion){console.log(JSON.stringify(await withWindow({...existing,healthOnly:true})));}
    else{
      if((health||recover)&&await disabled()){console.log(JSON.stringify({ok:true,disabled:true}));ws.close();process.exit(0);}
      // A previous attempt may have installed the skin before the native login
      // controls were ready. Confirm the artwork on this path as well.
      const cached=existing?.version===themeVersion&&existing?.ok&&existing?.readyForHandoff&&existing?.active;
      let install='window.__SPIDER_CODEX_V3__?.diagnose()';
      if(!cached){
        const art=await fs.readFile(path.join(root,'assets','client-brighter.png'));
        install=`${themeSource}(${JSON.stringify(await themeConfig(root,art))})`;
      }
      const result=await evaluate(`(async()=>{
        const result=${install};
        if(!result?.readyForHandoff)return result;
        const theme=window.__SPIDER_CODEX_V3__,image=new Image();image.src=theme?.wallpaperUrl||'';
        try{await image.decode()}catch{
          theme?.remove();return {...result,ok:false,active:false,readyForHandoff:false,reason:'background-decode-failed'};
        }
        await Promise.race([new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))),new Promise(resolve=>setTimeout(resolve,100))]);
        return {...result,backgroundDecoded:true};
      })()`);
      if(result?.version!==themeVersion){console.log(JSON.stringify(await withWindow(result)));process.exitCode=4;}
      else{
        // Reload registrations live on the keeper's persistent connection.
        if((health||recover)&&await disabled())await evaluate('window.__SPIDER_CODEX_V3__?.remove()');
        console.log(JSON.stringify(await withWindow(result)));
        if(!health&&(!result.ok||!result.readyForHandoff))process.exitCode=4;
      }
    }
  }
}catch(error){console.error(error.message);process.exitCode=5;}finally{ws.close();}
