import {createServer} from 'node:http';
import {readFile,writeFile,mkdir,stat} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {setTimeout as wait} from 'node:timers/promises';
import path from 'node:path';

const [browser, profile, viewport='1280,900', scale='1',...options] = process.argv.slice(2);
if (!browser || !profile || !/^\d{3,4},\d{3,4}$/.test(viewport) || !['1','1.25','1.5','2'].includes(scale)||options.some(option=>!['--reuse-fixture','--native-pointer'].includes(option)))
  throw Error('Give the Chromium executable, a new fixture profile, optional width,height and scale (1, 1.25, 1.5, 2).');
const reuse=options.includes('--reuse-fixture'),nativePointer=options.includes('--native-pointer');
const folder = path.resolve(profile);
await mkdir(path.dirname(folder), {recursive: true});
const ownershipFile=path.join(folder,'.spidercodex-headless-fixture.json');
try{await mkdir(folder);}catch(error){
  if(error.code!=='EEXIST'||!reuse)throw error;
  const saved=await readFile(ownershipFile,'utf8').then(JSON.parse,()=>null);
  if(saved?.schemaVersion!==1||saved.kind!=='spidercodex-headless-fixture'||saved.root!==folder)throw Error('Existing browser profile is not a recognized test fixture');
  if(saved.activePid){let alive=true;try{process.kill(saved.activePid,0)}catch(error){if(error.code==='ESRCH')alive=false;else throw error;}if(alive)throw Error('This fixture browser may still be running');}
}
const ownership={schemaVersion:1,kind:'spidercodex-headless-fixture',root:folder,activePid:null};
await writeFile(ownershipFile,JSON.stringify(ownership));
const fixture = await readFile(new URL('surface-fixture.html', import.meta.url), 'utf8');
const overlay = await readFile(new URL('../runtime/spider-theme.js', import.meta.url), 'utf8');
const targetScope = await readFile(new URL('../runtime/target-scope.mjs', import.meta.url), 'utf8');
const server = createServer((req,res)=>{
  const request=new URL(req.url,'http://127.0.0.1');
  if (request.pathname === '/') res.writeHead(200, {'Content-Type':'text/html; charset=utf-8'}).end(fixture);
  else if (request.pathname === '/target-scope-fixture.mjs') res.writeHead(200, {'Content-Type':'text/javascript; charset=utf-8'}).end(targetScope);
  else if (request.pathname === '/theme-fixture-module.mjs') {
    let module=request.searchParams.get('upgrade')==='1'?overlay.replace(/VERSION=(\d+)/,(_,version)=>'VERSION='+(Number(version)+1)):overlay;
    if(request.searchParams.get('edit')==='1')module=module.replace('--spider-action-light:.35;','--spider-action-light:.36;');
    res.writeHead(200, {'Content-Type':'text/javascript; charset=utf-8'}).end('export default '+module);
  }
  else res.writeHead(404).end();
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const url='http://127.0.0.1:'+server.address().port+'/'+(nativePointer?'?native-pointer=1':'');

async function exerciseFixture(startedAt){
  const portFile=path.join(folder,'DevToolsActivePort');
  let endpoint;
  for(let tries=0;!endpoint&&tries<60;tries++){
    try{
      if((await stat(portFile)).mtimeMs>=startedAt){
        const port=Number((await readFile(portFile,'utf8')).split('\n')[0]);
        if(Number.isInteger(port)&&port>1024&&port<=65535){
          const pages=await fetch('http://127.0.0.1:'+port+'/json/list',{signal:AbortSignal.timeout(600)}).then(response=>response.json());
          const page=pages.find(item=>item.type==='page'&&item.url===url);
          if(page){
            const socketUrl=new URL(page.webSocketDebuggerUrl);
            if(socketUrl.hostname!=='127.0.0.1'||Number(socketUrl.port)!==port)throw Error('Unexpected fixture socket');
            endpoint=socketUrl.href;
          }
        }
      }
    }catch{}
    if(!endpoint)await wait(80);
  }
  if(!endpoint)throw Error('Could not connect to the isolated pointer fixture');
  const ws=new WebSocket(endpoint);
  let next=0;
  try{
    await new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>reject(Error('Fixture socket open timed out')),2000);
      ws.onopen=()=>{clearTimeout(timer);resolve();};
      ws.onerror=()=>{clearTimeout(timer);reject(Error('Fixture socket open failed'));};
    });
    const call=(method,params={})=>new Promise((resolve,reject)=>{
      const id=++next;
      const timer=setTimeout(()=>reject(Error(method+' timed out')),2500);
      ws.onmessage=event=>{
        const message=JSON.parse(event.data);
        if(message.id!==id)return;
        clearTimeout(timer);
        if(message.error)reject(Error(message.error.message));else resolve(message.result);
      };
      ws.send(JSON.stringify({id,method,params}));
    });
    const evaluate=async expression=>{
      const result=await call('Runtime.evaluate',{expression,returnByValue:true});
      if(result.exceptionDetails)throw Error('Fixture evaluation failed');
      return result.result.value;
    };
    const until=async(expression,accept)=>{
      for(let tries=0;tries<100;tries++){
        const result=await evaluate(expression);
        if(accept(result))return result;
        await wait(90);
      }
      throw Error('The fixture did not reach the expected pointer state');
    };
    if(nativePointer)for(const expected of ['attachment-enabled','attachment-disabled','enabled','disabled']){
      const point=await until('window.fixturePointerStep',value=>value?.step===expected);
      if(!Number.isFinite(point.x)||!Number.isFinite(point.y)||point.x<0||point.y<0)throw Error('Invalid fixture pointer position');
      await call('Input.dispatchMouseEvent',{type:'mouseMoved',x:point.x,y:point.y});
      await evaluate('window.finishFixturePointerStep(); true');
    }
    const result=await until('document.querySelector("#fixture-result")?.textContent',Boolean);
    return JSON.parse(result);
  }finally{ws.close();}
}
try {
  let child;
  const startedAt=Date.now();
  const execution=new Promise((resolve,reject)=>{child=execFile(browser, [
    '--headless', '--no-first-run', '--no-default-browser-check', '--disable-background-networking', '--disable-extensions',
    '--user-data-dir='+folder, '--window-size='+viewport,'--force-device-scale-factor='+scale,
    '--remote-debugging-port=0','--remote-debugging-address=127.0.0.1',
    url,
  ], {windowsHide:true, timeout:20000},(error,stdout,stderr)=>error?reject(error):resolve({stdout,stderr}));});
  ownership.activePid=child.pid;
  try{await writeFile(ownershipFile,JSON.stringify(ownership));}catch(error){child.kill();await execution.catch(()=>{});throw error;}
  let result;
  try{
    result=await Promise.race([exerciseFixture(startedAt),execution.then(()=>{throw Error('The isolated fixture browser exited prematurely');})]);
    if(nativePointer&&(result.newFeatureStandard?.clippedHighlight!==true||result.newFeatureStandard?.disabledInert!==true))result.passed=false;
  }finally{child.kill();await execution.catch(()=>{});}
  console.log(JSON.stringify(result, null, 2));
  if (!result.passed) process.exitCode=1;
} finally {
  ownership.activePid=null;
  await writeFile(ownershipFile,JSON.stringify(ownership));
  server.close();
}
