import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import test from 'node:test';

test('temporary asset failure retains the previous payload and retries the same revision',async()=>{
  const source=await readFile(new URL('../runtime/theme-keeper.mjs',import.meta.url),'utf8');
  const start=source.indexOf('async function payload(){');
  const end=source.indexOf('async function connection(',start);
  assert.ok(start>=0&&end>start);
  let revision=1;
  let unavailable=false;
  const session={registeredVersion:1};
  const context=vm.createContext({path,dir:'/runtime',root:'/app',loadingPreview:'(()=>{})()',themeConfig:async(_,art)=>({wallpaper:art.toString('base64')}),sessions:new Map([['page',session]]),
    fs:{stat:async()=>({size:10,mtimeMs:revision,ctimeMs:revision,ino:1}),readFile:async(file)=>{
      if(file.endsWith('spider-theme.js'))return `(function theme(){const VERSION=${revision};return VERSION;})`;
      if(unavailable)throw Error('asset temporarily unavailable');
      return Buffer.from('image-'+revision);
    }}});
  vm.runInContext(`let revision='',artStamp='',payloadToken=0,expression='',bootstrap='',version=0;${source.slice(start,end)}
    globalThis.load=payload;globalThis.current=()=>({revision,artStamp,payloadToken,expression,bootstrap,version});`,context);
  await context.load();
  const previous=context.current();
  session.registeredVersion=1;
  revision=2;unavailable=true;
  await assert.rejects(context.load(),/temporarily unavailable/);
  assert.deepEqual(context.current(),previous);
  assert.equal(session.registeredVersion,1);
  unavailable=false;
  await context.load();
  assert.equal(context.current().version,2);
  assert.ok(context.current().expression.includes(Buffer.from('image-2').toString('base64')));
  assert.equal(session.registeredVersion,0);
});

test('wallpaper updates without a CSS version bump are reloaded once',async()=>{
  const source=await readFile(new URL('../runtime/theme-keeper.mjs',import.meta.url),'utf8');
  const start=source.indexOf('async function payload(){');
  const end=source.indexOf('async function connection(',start);
  let stamp=1,reads=0;
  const context=vm.createContext({path,dir:'/runtime',root:'/app',loadingPreview:'(()=>{})()',themeConfig:async(_,art)=>({wallpaper:art.toString('base64')}),sessions:new Map(),fs:{
    stat:async()=>({size:12,mtimeMs:stamp,ctimeMs:stamp,ino:1}),
    readFile:async file=>{
      if(file.endsWith('spider-theme.js'))return '(function theme(){const VERSION=1;return VERSION;})';
      reads++;return Buffer.from('wallpaper-'+stamp);
    }
  }});
  vm.runInContext(`let revision='',artStamp='',payloadToken=0,expression='',bootstrap='',version=0;${source.slice(start,end)}
    globalThis.load=payload;globalThis.current=()=>({version,payloadToken,expression});`,context);
  await context.load();
  const previous=context.current();
  await context.load();
  assert.equal(reads,1);
  stamp=2;await context.load();
  assert.equal(context.current().version,previous.version);
  assert.equal(context.current().payloadToken,previous.payloadToken+1);
  assert.notEqual(context.current().expression,previous.expression);
  await context.load();
  assert.equal(reads,2);
});

test('metadata replacement failure keeps the old JSON intact and retries',async()=>{
  const source=await readFile(new URL('../runtime/theme-keeper.mjs',import.meta.url),'utf8');
  const start=source.indexOf("let lastMetadata=''");
  const end=source.indexOf('try{while(true){',start);
  assert.ok(start>=0&&end>start);
  const files=new Map([['/state/keeper.json','previous complete JSON']]);
  let locked=true;
  const context=vm.createContext({metaFile:'/state/keeper.json',owner:11,version:8,process:{pid:22},
    sessions:new Map(),fs:{
      writeFile:async(name,data)=>files.set(name,data),
      rename:async(from,to)=>{if(locked)throw Error('replacement blocked');files.set(to,files.get(from));files.delete(from);},
      unlink:async(name)=>files.delete(name)
    }});
  vm.runInContext(source.slice(start,end)+'\nglobalThis.publish=metadata;',context);
  await assert.rejects(context.publish(false),/blocked/);
  assert.equal(files.get('/state/keeper.json'),'previous complete JSON');
  assert.equal(files.size,1);
  locked=false;
  await context.publish(false);
  const stored=JSON.parse(files.get('/state/keeper.json'));
  assert.equal(stored.owner,11);
  assert.equal(stored.status,'running');
  assert.equal(files.size,1);
});

test('the keeper cannot follow a replacement client on the same local port',async()=>{
  const source=await readFile(new URL('../runtime/theme-keeper.mjs',import.meta.url),'utf8');
  const first=source.indexOf('async function binding(){');
  const end=source.indexOf('try{while(true){',first);
  assert.ok(first>=0&&end>first);
  const record={monitorPid:30,port:9342,clientPid:42,createdTicks:1234};
  let running=true;
  const context=vm.createContext({path,state:'/state',owner:30,port:9342,suffix:'.qa',
    fs:{readFile:async()=>JSON.stringify(record)},process:{kill(pid){assert.equal(pid,42);if(!running)throw Error('exited');}}});
  vm.runInContext('let boundClient=null;'+source.slice(first,end)+'\nglobalThis.check=binding;',context);
  assert.equal(await context.check(),true);
  record.clientPid=43;
  assert.equal(await context.check(),false);
  record.clientPid=42;record.createdTicks++;
  assert.equal(await context.check(),false);
  record.createdTicks--;running=false;
  assert.equal(await context.check(),false);
});

test('foreground recovery requires observed browser sign-in followed by the managed workspace',async()=>{
  const source=await readFile(new URL('../runtime/theme-keeper.mjs',import.meta.url),'utf8');
  const start=source.indexOf('function loginReturn('),end=source.indexOf('const loginPhase=',start);
  assert.ok(start>=0&&end>start);
  const transition=vm.runInNewContext(source.slice(start,end)+'loginReturn');
  const empty={waitingAt:0,completedAt:0};
  assert.equal(transition(empty,'workspace',1000).completedAt,0);
  const waiting=transition(empty,'waiting',2000);
  const returned=transition(transition(waiting,null,2250),'workspace',2500);
  assert.equal(returned.completedAt,2500);
  assert.equal(returned.waitingAt,0);
  assert.equal(transition(returned,'workspace',3500).completedAt,2500);
  assert.equal(transition(transition(waiting,'login',2250),'workspace',2500).completedAt,0);
  const stale=transition(waiting,'waiting',303000);
  assert.equal(transition(stale,'workspace',304000).completedAt,0);
});
