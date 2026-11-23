import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import test from 'node:test';

test('timed-out scroll inspection cancels its remaining animation and restores the view',async()=>{
  const source=await readFile(new URL('native-client-session.mjs',import.meta.url),'utf8');
  const start=source.indexOf('async function inspectNativeMenu(');
  assert.ok(start>=0);
  const animations=new Map(),timers=new Map();
  let id=0,position=800,writes=0;
  const area={
    isConnected:true,clientHeight:200,scrollHeight:1000,
    checkVisibility:()=>true,matches:()=>false,
    getBoundingClientRect:()=>({width:500,height:200,top:0,bottom:200}),
    get scrollTop(){return position},
    set scrollTop(value){position=Math.max(0,Math.min(800,value));writes++}
  };
  const document={visibilityState:'visible',documentElement:{getAttribute:()=> 'workspace'},
    querySelectorAll:selector=>selector==='.thread-scroll-container'?[area]:[]};
  const context=vm.createContext({document,location:{href:'app://-/index.html'},URL,innerHeight:900,
    requestAnimationFrame:fn=>{const key=++id;animations.set(key,fn);return key},
    cancelAnimationFrame:key=>animations.delete(key),
    setTimeout:fn=>{const key=++id;timers.set(key,fn);return key},
    clearTimeout:key=>timers.delete(key)});
  vm.runInContext(source.slice(start)+'\nglobalThis.inspect=inspectNativeMenu;',context);
  const result=context.inspect('chat-scroll-check');
  const [first,callback]=animations.entries().next().value;
  animations.delete(first);callback(10);
  const stale=animations.values().next().value;
  const [timer,expire]=timers.entries().next().value;
  timers.delete(timer);expire();
  const completed=await result;
  assert.equal(completed.completed,false);
  assert.equal(position,800);
  assert.equal(animations.size,0);
  const finalWrites=writes;
  stale(20);
  assert.equal(writes,finalWrites);
});

test('returning from settings can reopen only the identified existing task row',async()=>{
  const source=await readFile(new URL('native-client-session.mjs',import.meta.url),'utf8');
  const start=source.indexOf('async function inspectNativeMenu(');
  const clicks=[];
  const makeRow=id=>({isConnected:true,checkVisibility:()=>true,matches:()=>false,closest:()=>null,
    getBoundingClientRect:()=>({width:200,height:36,top:61,bottom:97}),getAttribute:()=>id,click:()=>clicks.push(id)});
  const task='local:original-task';
  const rows=[makeRow('local:unrelated'),makeRow(task)];
  let page='workspace';
  const document={documentElement:{getAttribute:()=>page,dataset:{get spiderSurface(){return page;}}},
    querySelectorAll:selector=>selector.startsWith('aside [data-app-action-sidebar-thread-id]')?rows:[]};
  const context=vm.createContext({document,location:{href:'app://-/index.html'},URL,innerHeight:900});
  vm.runInContext(source.slice(start)+'\nglobalThis.inspect=inspectNativeMenu;',context);
  await context.inspect('restore-task-thread',task);
  assert.deepEqual(clicks,[task]);
  await assert.rejects(context.inspect('restore-task-thread','local:missing'),/ambiguous or unavailable/);
  page='settings';
  await assert.rejects(context.inspect('restore-task-thread',task),/outside the native workspace/);
  assert.deepEqual(clicks,[task]);
});

test('opening the empty native home protects the current task and any draft', async()=>{
  const source=await readFile(new URL('native-client-session.mjs',import.meta.url),'utf8');
  const start=source.indexOf('async function inspectNativeMenu(');
  assert.ok(start>=0);
  let draft='', hasAttachment=false, hidden=false, clicks=0;
  const original='local:original-task';
  const available={isConnected:true,checkVisibility:()=>true,matches:()=>false,closest:()=>null,
    getBoundingClientRect:()=>({width:200,height:36,top:61,bottom:97})};
  const row={...available,getAttribute:()=>original};
  const composer={...available,querySelectorAll:()=>[{textContent:draft}],querySelector:()=>hasAttachment?{}:null};
  const newChat={...available,textContent:'新聊天',click:()=>clicks++};
  const document={get visibilityState(){return hidden?'hidden':'visible';},
    documentElement:{dataset:{spiderSurface:'workspace'},getAttribute:()=> 'workspace'},
    querySelectorAll:selector=> selector.includes('ComposerLayoutRoot-')?[composer]:
      selector.startsWith('aside [data-app-action-sidebar-thread-id]')?[row]:selector==='aside button'?[newChat]:[]};
  const context=vm.createContext({document,location:{href:'app://-/index.html'},URL,innerHeight:900});
  vm.runInContext(source.slice(start)+'\nglobalThis.inspect=inspectNativeMenu;',context);
  await assert.rejects(context.inspect('open-empty-home','local:other-task'),/ambiguous or unavailable/);
  draft='unsent';await assert.rejects(context.inspect('open-empty-home',original),/unsaved draft or attachment/);
  draft='';hasAttachment=true;await assert.rejects(context.inspect('open-empty-home',original),/unsaved draft or attachment/);
  hasAttachment=false;hidden=true;await assert.rejects(context.inspect('open-empty-home',original),/outside the visible native workspace/);
  assert.equal(clicks,0);
  hidden=false;await context.inspect('open-empty-home',original);
  assert.equal(clicks,1);
});
