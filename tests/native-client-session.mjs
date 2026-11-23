import fs from 'node:fs/promises';
import {isClientPage} from '../runtime/target-scope.mjs';

const inspectionActions=new Set([
  'attachment','model','model-list','model-focus-slider','account','account-spaces','chat-tab','composer-permission','open-empty-home','restore-task-thread',
  'qa-account-personalization','qa-account-help-menu','qa-account-help-first-row','qa-account-profile-page','qa-account-profile-back',
  'qa-team-workspace-settings','qa-team-add-members',
  'qa-switch-personal-space','qa-switch-team-space',
  'workspace-usage','workspace-search',
  'workspace-projects-fold','workspace-recent-fold','workspace-projects-menu','workspace-projects-organize','workspace-projects-sort',
  'search-qa-match','search-qa-empty-result','search-qa-reset','search-qa-next','search-qa-scroll',
  'top-file','top-edit','top-view','top-help','top-view-browser',
  'settings','qa-dismiss-popup','qa-dismiss-settings','settings-shortcut','settings-back','settings-host-back','general','appearance','notifications','appearance-advanced',
  'general-shell','general-language','general-open-location','general-environment','general-close-confirm',
  'general-auto-archive','general-speed','general-reasoning','general-send-shortcut','general-notification-mode','general-notification-sound',
  'notification-mode','notification-personalization',
  'notification-tasks','notification-usage','notification-health','notification-replies',
  'notification-groups','notification-marketing','notification-library','notification-projects',
  'appearance-font','appearance-theme','appearance-code-themes','appearance-content-font','appearance-code-font','appearance-accent',
  'appearance-background','appearance-foreground',
  'chat-down','chat-up','chat-bottom','chat-scroll-check',
  'popup-down','popup-up','settings-down','settings-top',
  'settings-list-bottom',
  'file-card-scroll','file-card-more','media-scroll','activity-scroll','sidebar-top','sidebar-down','sidebar-restore','settings-import','settings-account','settings-archives','settings-voice','settings-storage',
  'settings-personalization','settings-companions','settings-shortcuts','settings-usage','settings-data',
  'settings-plugins','settings-snapshots','settings-browser','settings-cloud','settings-connections',
  'settings-codex-cloud','settings-review','settings-git','settings-worktrees','inspection-dismiss'
]);
const readonlyMethods=new Set([
  'Runtime.evaluate','Runtime.getProperties','Runtime.getHeapUsage','Runtime.enable',
  'Performance.enable','Performance.getMetrics','Performance.disable',
  'Page.enable','Page.getLayoutMetrics','Page.getFrameTree','Page.captureScreenshot',
  'Schema.getDomains','DOM.getDocument','DOM.getBoxModel','Browser.getWindowForTarget'
]);
const mutatingExpression=/(?:\.click\s*\(|\.dispatchEvent\s*\(|\.focus\s*\(|\.blur\s*\(|\.remove\s*\(|\.append(?:Child)?\s*\(|\.prepend\s*\(|\.setAttribute\s*\(|\.removeAttribute\s*\(|\.classList\.(?:add|remove|toggle)|\.scroll(?:To|By|IntoView)\s*\(|\.scroll(?:Top|Left)\s*=(?!=)|location(?:\.href)?\s*=(?!=)|location\.(?:assign|replace)\s*\(|electronBridge|document\.write|history\.(?:back|forward|go)|(?:innerHTML|outerHTML|textContent)\s*=(?!=)|\.style\.|window\.close)/;

export async function client({allowMenuInspection=false,verifiedQaPort=null}={}){
  let port;
  if(verifiedQaPort!==null){
    // The Windows harness first verifies the isolated PID, start time,
    // owned profile and loopback listener. Do not use the active chat port.
    if(![9384,9388].includes(verifiedQaPort)||process.env.SPIDERCODEX_SIGNED_IN_QA_PORT!==String(verifiedQaPort))throw Error('The isolated QA port was not verified');
    port=verifiedQaPort;
  }else{
    const directory=process.env.LOCALAPPDATA+'/SpiderCodex/';
    const state=JSON.parse(await fs.readFile(directory+'session.json','utf8'));
    const attachment=JSON.parse(await fs.readFile(directory+'attachment.json','utf8'));
    port=state.port;
    if(!Number.isInteger(port)||port<1024||port>65535||attachment.port!==port||attachment.monitorPid!==state.pid){
      throw Error('Native session ownership changed');
    }
  }
  const pages=await fetch('http://127.0.0.1:'+port+'/json/list').then(r=>r.json());
  const targets=pages.filter(isClientPage);
  if(targets.length!==1)throw Error('Native main page missing or ambiguous');
  const url=new URL(targets[0].webSocketDebuggerUrl);
  if(!['127.0.0.1','localhost'].includes(url.hostname)||Number(url.port)!==port){
    throw Error('Non-local or mismatched endpoint');
  }
  const ws=new WebSocket(url);
  await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{ws.close();reject(Error('Native debugger connection timed out'));},5000);
    ws.onopen=()=>{clearTimeout(timer);resolve();};
    ws.onerror=()=>{clearTimeout(timer);reject(Error('Native debugger connection failed'));};
  });
  let id=0;
  const pending=new Map();
  const failPending=()=>{
    for(const task of pending.values()){
      clearTimeout(task.timer);
      task.reject(Error('Native debugger session closed'));
    }
    pending.clear();
  };
  ws.onclose=failPending;
  ws.onerror=failPending;
  ws.onmessage=({data})=>{
    const message=JSON.parse(data);
    const task=pending.get(message.id);
    if(!task)return;
    clearTimeout(task.timer);
    pending.delete(message.id);
    if(message.error)task.reject(Error(message.error.message));
    else task.resolve(message.result);
  };
  const send=(method,params={})=>new Promise((resolve,reject)=>{
    const next=++id;
    const timer=setTimeout(()=>{
      pending.delete(next);
      reject(Error('Timed out '+method));
    },10000);
    pending.set(next,{resolve,reject,timer});
    ws.send(JSON.stringify({id:next,method,params}));
  });
  const call=(method,params={})=>{
    if(!readonlyMethods.has(method)||
        (method==='Runtime.evaluate'&&mutatingExpression.test(params.expression||''))){
      return Promise.reject(Error('Current chat host is read-only during tests; input, navigation and DOM mutations are blocked. Use an isolated QA client.'));
    }
    return send(method,params);
  };
  const evaluate=async expression=>{
    const result=await call('Runtime.evaluate',{
      expression,returnByValue:true,awaitPromise:true
    });
    if(result.exceptionDetails)throw Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  };
  const inspectMenu=async (action,value)=>{
    if(!allowMenuInspection||!inspectionActions.has(action)){
      throw Error('Only specifically authorized menu inspection is allowed');
    }
    if(action==='qa-account-profile-back'){
      if(verifiedQaPort!==9388)throw Error('Profile navigation requires the verified isolated QA window');
      const point=await evaluate(`(()=>{
        if(document.visibilityState!=='visible'||!document.hasFocus()||!['other','profile'].includes(document.documentElement.dataset.spiderSurface))return null;
        const visible=e=>e.checkVisibility({visibilityProperty:true,opacityProperty:true})&&e.getBoundingClientRect().width>0;
        const page=[...document.querySelectorAll('main[data-app-shell-main-surface]')].find(visible);
        if(!page?.querySelector('h1[class*="identityHeading-"]')||!page.querySelector('section[class~="group/profile-section"]'))return null;
        const buttons=[...document.querySelectorAll('button:is([aria-label="返回"],[aria-label="Back"])')].filter(visible);
        if(buttons.length!==1)return null;
        const target=buttons[0],r=target.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2;
        return target.contains(document.elementFromPoint(x,y))?{x,y}:null;
      })()`);
      if(!point)throw Error('A unique profile Back command could not be verified');
      await send('Input.dispatchMouseEvent',{type:'mouseMoved',button:'none',buttons:0,...point});
      await send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',buttons:1,clickCount:1,...point});
      await send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',buttons:0,clickCount:1,...point});
      return {action,invoked:true};
    }
    const accountCommands={
      'qa-account-personalization':'^(个性化|Personalization)$',
      'qa-account-help-menu':'^(帮助|Help)$',
      'qa-account-help-first-row':'^(新功能|What.s new)$',
      'qa-account-profile-page':'^(个人资料|Profile)$',
      'qa-team-workspace-settings':'^(工作空间设置|工作区设置|Workspace settings)$',
      'qa-team-add-members':'^(添加团队成员|邀请团队成员|Add team members|Invite team members)$',
    };
    if(Object.hasOwn(accountCommands,action)){
      if(verifiedQaPort!==9388)throw Error('Account menu navigation requires the verified isolated QA window');
      const help=action==='qa-account-help-menu';
      const helpFirst=action==='qa-account-help-first-row';
      const requireInApp=action.startsWith('qa-team-')||action==='qa-account-profile-page';
      const point=await evaluate(`(()=>{
        if(document.visibilityState!=='visible'||!document.hasFocus()||document.documentElement.dataset.spiderSurface!=='workspace')return null;
        const visible=e=>e.checkVisibility({visibilityProperty:true,opacityProperty:true})&&e.getBoundingClientRect().width>0;
        const menus=[...document.querySelectorAll('[role="menu"]')].filter(visible);
        const help=${help};
        const helpFirst=${helpFirst};
        if(menus.length!==(helpFirst?2:1))return null;
        const label=new RegExp(${JSON.stringify(accountCommands[action])},'i');
        const items=[...menus[helpFirst?1:0].querySelectorAll('[role="menuitem"]')].filter(e=>visible(e)&&label.test(e.innerText.trim())&&!e.matches('[aria-disabled="true"],[data-disabled]'));
        if(items.length!==1||(help&&items[0].getAttribute('aria-haspopup')!=='menu'))return null;
        const target=items[0];
        if(${requireInApp}&&(target.matches('a[href]')||target.querySelector('a[href]')))return null;
        const r=target.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2;
        return target.contains(document.elementFromPoint(x,y))?{x,y}:null;
      })()`);
      if(!point)throw Error('The intended account menu command is unavailable');
      await send('Input.dispatchMouseEvent',{type:'mouseMoved',button:'none',buttons:0,...point});
      if(!help&&!helpFirst){
        await send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',buttons:1,clickCount:1,...point});
        await send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',buttons:0,clickCount:1,...point});
      }
      return {action,invoked:true};
    }
    const portalSections={
      general:['常规','General'],appearance:['外观','Appearance'],notifications:['通知','Notifications'],
      'settings-account':['账户','账号','Account'],'settings-personalization':['个性化','Personalization'],
      'settings-shortcuts':['键盘快捷键','Keyboard shortcuts'],'settings-voice':['语音','Voice'],
      'settings-storage':['存储','设备存储','Storage','Device storage'],'settings-data':['数据管理','Data controls'],
      'settings-archives':['已归档的聊天','Archived chats'],'settings-connections':['连接','Connections'],
      'settings-browser':['浏览器','Browser'],'settings-git':['Git'],'settings-worktrees':['Worktrees','工作树'],
      'settings-review':['代码审查','Code review'],'settings-import':['导入','Import'],
      'settings-usage':['使用情况和计费','Usage and billing'],'settings-plugins':['插件','Plugins'],
      'settings-companions':['迷你界面和智能伙伴','Mini window and companions'],
      'settings-snapshots':['应用快照','App snapshots'],'settings-cloud':['云电脑','Cloud computer'],
      'settings-codex-cloud':['Codex 云端','Codex cloud']
    };
    if(verifiedQaPort===9388&&Object.hasOwn(portalSections,action)){
      const posResult=await send('Runtime.evaluate',{expression:`(()=>{
       if(location.protocol!=='app:'||location.hostname!=='-'||location.pathname!=='/index.html'||location.href.toLowerCase().includes('avatar-overlay'))return null;
       const d=[...document.querySelectorAll('[role="dialog"].settings-dialog')].find(e=>e.checkVisibility({visibilityProperty:true,opacityProperty:true}));
       if(!d||document.documentElement.dataset.spiderSurface!=='settings')return null;
       const labels=${JSON.stringify(portalSections[action])};
       const buttons=[...d.querySelectorAll('.settings-dialog-nav-list button')].filter(e=>labels.includes(e.textContent.trim())&&e.checkVisibility({visibilityProperty:true})&&!e.disabled);
       if(buttons.length!==1)return null;
       const b=buttons[0];
       const nav=b.closest('.settings-dialog-nav-list'),box=nav.getBoundingClientRect();
       const before=b.getBoundingClientRect();
       if(before.top<box.top||before.bottom>box.bottom)nav.scrollTop+=before.top-box.top-(nav.clientHeight-before.height)/2;
       const r=b.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2;
       return b.contains(document.elementFromPoint(x,y))?{x,y}:null;
      })()`,returnByValue:true});
      const pos=posResult.result?.value;
      if(pos){
       await send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',buttons:1,clickCount:1,...pos});
       await send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',buttons:0,clickCount:1,...pos});
       return {action,invoked:true};
      }
    }
    if(action==='qa-dismiss-settings'){
      if(verifiedQaPort!==9388)throw Error('Settings dismissal requires the verified isolated QA window');
      const pos=await evaluate(`(()=>{
        const d=[...document.querySelectorAll('[role="dialog"].settings-dialog')].find(e=>e.checkVisibility({visibilityProperty:true,opacityProperty:true}));
        if(!d||document.documentElement.dataset.spiderSurface!=='settings')return null;
        const r=d.getBoundingClientRect(),x=r.left/2,y=innerHeight/2;
        const hit=document.elementFromPoint(x,y);
        return x>0&&hit&&!d.contains(hit)&&hit.getAttribute('data-state')==='open'?{x,y}:null;
      })()`);
      if(!pos)throw Error('No safe settings backdrop target');
      await send('Input.dispatchMouseEvent',{type:'mouseMoved',button:'none',buttons:0,...pos});
      await send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',buttons:1,clickCount:1,...pos});
      await send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',buttons:0,clickCount:1,...pos});
      return {action,invoked:true};
    }
    if(action==='qa-switch-personal-space'||action==='qa-switch-team-space'){
      if(verifiedQaPort!==9388)throw Error('Workspace switching requires the verified isolated QA window');
      const point=await evaluate(`(()=>{
        if(!document.hasFocus()||document.visibilityState!=='visible')return null;
        const shown=e=>e.checkVisibility({visibilityProperty:true,opacityProperty:true})&&e.getBoundingClientRect().width>0;
        const menus=[...document.querySelectorAll('[role="menu"]')].filter(shown);
        if(menus.length!==2)return null;
        const candidates=menus.flatMap(m=>[...m.querySelectorAll('[role="menuitem"]')])
          .filter(e=>shown(e)&&e.querySelector('img')&&!e.matches('[aria-haspopup],[aria-disabled="true"],[data-disabled]'));
        const personal=/^(个人账户|个人账号|个人空间|Personal|Personal account|Personal workspace)$/i;
        if(candidates.length!==2||candidates.filter(e=>personal.test(e.textContent.trim())).length!==1)return null;
        const target=candidates.find(e=>personal.test(e.textContent.trim())===${action==='qa-switch-personal-space'});
        const {left,top,width,height}=target.getBoundingClientRect();
        const x=left+width/2,y=top+height/2;
        return target.contains(document.elementFromPoint(x,y))?{x,y}:null;
      })()`);
      if(!point)throw Error('The target workspace is not uniquely reachable');
      await send('Input.dispatchMouseEvent',{type:'mouseMoved',button:'none',buttons:0,...point});
      await send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',buttons:1,clickCount:1,...point});
      await send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',buttons:0,clickCount:1,...point});
      return {action,invoked:true};
    }
    if(action==='qa-dismiss-popup'){
      if(verifiedQaPort!==9388)throw Error('Popup dismissal requires the verified isolated QA window');
      const ready=await evaluate(`document.visibilityState==='visible'&&document.hasFocus()&&
        [...document.querySelectorAll('[role="menu"],[role="dialog"]')].some(e=>e.checkVisibility({visibilityProperty:true,opacityProperty:true}))`);
      if(!ready)throw Error('No visible QA popup to dismiss');
      const key={key:'Escape',code:'Escape',windowsVirtualKeyCode:27,nativeVirtualKeyCode:27};
      await send('Input.dispatchKeyEvent',{type:'rawKeyDown',...key});
      await send('Input.dispatchKeyEvent',{type:'keyUp',...key});
      return {action,invoked:true};
    }
    if(action==='settings-shortcut'){
      if(verifiedQaPort!==9388)throw Error('The settings shortcut is restricted to the verified isolated QA client');
      const ready=await evaluate(`document.hasFocus()&&document.visibilityState==='visible'&&
       ![...document.querySelectorAll('[role="menu"],[role="dialog"]')].some(e=>e.checkVisibility({visibilityProperty:true,opacityProperty:true}))`);
      if(!ready)throw Error('The isolated client must be focused without a modal before opening settings');
      const key={key:',',code:'Comma',windowsVirtualKeyCode:188,nativeVirtualKeyCode:188,modifiers:2};
      await send('Input.dispatchKeyEvent',{type:'rawKeyDown',...key});
      await send('Input.dispatchKeyEvent',{type:'keyUp',...key});
      return {action,invoked:true};
    }
    if(action==='settings-host-back'||(action==='settings'&&verifiedQaPort===9388)){
      if(verifiedQaPort===null)throw Error('Embedded shell navigation requires the isolated QA window');
      const p=await evaluate(`(() => {
        const view=document.documentElement.dataset.spiderSurface;
        if(location.protocol!=='app:'||location.hostname!=='-'||location.pathname!=='/index.html')return null;
        const shown=e=>e.checkVisibility({visibilityProperty:true,opacityProperty:true})&&e.getBoundingClientRect().width>0;
        if(${JSON.stringify(action)}==='settings'){
          if(view!=='workspace'&&!(view==null&&document.querySelector('[data-app-shell-main-surface] [data-codex-composer],.composer-surface-chrome')))return null;
          const matches=[...document.querySelectorAll('[role="menu"] [role="menuitem"]')].filter(e=>shown(e)&&/^(设置|Settings)(?:\\s|Ctrl|⌘|$)/.test(e.textContent.trim())&&!e.matches('[aria-disabled="true"],[data-disabled]'));
          if(matches.length!==1)return null;
          const target=matches[0],r=target.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2;
          return target.contains(document.elementFromPoint(x,y))?{x,y}:null;
        }
        if(view!=='settings-host')return null;
        const roots=[...document.querySelectorAll('main.no-drag.bg-surface')].filter(e=>e.checkVisibility()&&e.querySelector('webview'));
        if(roots.length!==1)return null;
        const buttons=[...roots[0].querySelectorAll('header button[aria-label]')].filter(e=>e.checkVisibility()&&/^(返回 ChatGPT|返回 Codex|Back to ChatGPT|Back to Codex)$/.test(e.getAttribute('aria-label')));
        if(buttons.length!==1)return null;
        const target=buttons[0],r=target.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2;
        return target.contains(document.elementFromPoint(x,y))?{x,y}:null;
      })()`);
      if(!p)throw Error('The native settings command is not safely clickable');
      await send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',buttons:1,clickCount:1,...p});
      await send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',buttons:0,clickCount:1,...p});
      return {action,invoked:true};
    }
    if(action==='sidebar-restore'&&(!Number.isFinite(value)||value<0||value>100000))throw Error('Invalid bounded sidebar scroll restoration');
    if(action==='restore-task-thread'||action==='open-empty-home'){
      const thread=process.env.CODEX_THREAD_ID;
      if(value!==undefined||!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(thread??''))throw Error('The current task thread must be identified by the host');
      value='local:'+thread;
    }
    const result=await send('Runtime.evaluate',{
      expression:'('+inspectNativeMenu.toString()+')('+JSON.stringify(action)+','+JSON.stringify(value??null)+')',
      returnByValue:true,awaitPromise:true
    });
    if(result.exceptionDetails)throw Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  };
  const inspectHover=async (action,index)=>{
    if(!allowMenuInspection||!['home','account','account-profile','account-spaces','attachment','usage','permission','send','primary-action','settings-shell','settings-advanced','settings-switch','file-row','file-more','audit-sidebar','audit-settings','audit-files','audit-menus','audit-chat','audit-media','audit-activity','audit-workspace','clear'].includes(action))throw Error('Only specifically authorized hover inspection is allowed');
    if(action.startsWith('audit-')&&(!Number.isInteger(index)||index<0||index>511))throw Error('Hover audit index is outside the bounded inspection area');
    const result=await send('Runtime.evaluate',{expression:'('+inspectNativeHover.toString()+')('+JSON.stringify(action)+','+JSON.stringify(index??null)+')',returnByValue:true});
    if(result.exceptionDetails)throw Error(JSON.stringify(result.exceptionDetails));
    const point=result.result.value;
    await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:point.x,y:point.y,button:'none',buttons:0});
    return {action,invoked:true,identity:point.identity};
  };
  const inspectWheel=async direction=>{
    if(!allowMenuInspection||!['up','down'].includes(direction))throw Error('Only bounded chat wheel inspection is allowed');
    const result=await send('Runtime.evaluate',{
      expression:`(()=>{const page=new URL(location.href);if(page.protocol!=='app:'||page.hostname!=='-'||page.pathname!=='/index.html')throw Error('Outside native app');const areas=[...document.querySelectorAll('.thread-scroll-container')].filter(e=>e.checkVisibility()&&e.clientHeight>100&&e.scrollHeight>e.clientHeight+20);if(areas.length!==1)throw Error('Chat scroll target is ambiguous');const r=areas[0].getBoundingClientRect();const x=r.x+r.width*.65,y=Math.max(r.y,60)+Math.min(r.height*.45,innerHeight*.45);const hit=document.elementFromPoint(x,y);if(!hit||!areas[0].contains(hit))throw Error('Chat wheel target is covered');return {x,y,before:areas[0].scrollTop}})()`,returnByValue:true
    });
    if(result.exceptionDetails)throw Error(JSON.stringify(result.exceptionDetails));
    const point=result.result.value;
    await send('Input.dispatchMouseEvent',{type:'mouseWheel',x:point.x,y:point.y,deltaX:0,deltaY:direction==='up'?-480:480});
    return {direction,invoked:true,before:point.before};
  };
  const localFixturePoint=async threadId=>{
    if(!allowMenuInspection||verifiedQaPort!==9388||
      !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(threadId??''))
      throw Error('Reload requires the verified isolated fixture thread');
    const selected=await evaluate(`(()=>{
      const page=new URL(location.href), thread=${JSON.stringify('local:'+threadId)};
      if(page.protocol!=='app:'||page.hostname!=='-'||page.pathname!=='/index.html'||
         page.href.toLowerCase().includes('avatar-overlay')||document.visibilityState!=='visible')return false;
      const visible=e=>e.checkVisibility({opacityProperty:true,visibilityProperty:true})&&e.getBoundingClientRect().width>0;
      const fixture=[...document.querySelectorAll('aside [data-app-action-sidebar-thread-id]')]
       .filter(e=>e.getAttribute('data-app-action-sidebar-thread-id')===thread&&visible(e));
      const draft=[...document.querySelectorAll('.composer-surface-chrome [contenteditable], [data-codex-composer][contenteditable], [data-codex-composer] textarea')].some(e=>visible(e)&&(e.value??e.textContent).trim());
      if(fixture.length!==1||draft||
       [...document.querySelectorAll('[role="menu"],[role="dialog"],[data-attachment-id]')].some(visible))return null;
      const bounds=fixture[0].getBoundingClientRect(),x=bounds.x+bounds.width/2,y=bounds.y+bounds.height/2;
      const selected=[...document.querySelectorAll('.thread-scroll-container')].some(e=>visible(e)&&e.textContent.includes('本地客户端性能测试'));
      return fixture[0].contains(document.elementFromPoint(x,y))?{x,y,selected}:null;
    })()`);
    if(!selected)throw Error('The local fixture is unavailable or blocked by another control');
    return selected;
  };
  const reloadLocalFixture=async threadId=>{
    const current=await localFixturePoint(threadId);
    if(!current.selected)throw Error('Reload would leave a different conversation');
    await send('Page.reload',{ignoreCache:false});
  };
  const openLocalFixture=async threadId=>{
    const {x,y,selected}=await localFixturePoint(threadId);
    if(selected)return true;
    await send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',buttons:1,clickCount:1,x,y});
    await send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',buttons:0,clickCount:1,x,y});
    return true;
  };
  const cpuProfile=async action=>{
    if(!allowMenuInspection||verifiedQaPort!==9388||!['start','stop'].includes(action))
      throw Error('Profiler requires the verified isolated fixture client');
    if(action==='start'){
      await send('Profiler.enable');
      await send('Profiler.setSamplingInterval',{interval:1500});
      await send('Profiler.start');
    }else{
      const {profile}=await send('Profiler.stop');
      await send('Profiler.disable');
      return profile;
    }
  };
  return {call,evaluate,inspectMenu,inspectHover,inspectWheel,reloadLocalFixture,openLocalFixture,cpuProfile,close:()=>ws.close()};
}

function inspectNativeHover(action,index){
 const page=new URL(location.href);
 if(page.protocol!=='app:'||page.hostname!=='-'||page.pathname!=='/index.html')throw Error('Hover is outside the native app shell');
 if(action==='clear')return {x:innerWidth-1,y:innerHeight-1};
 const visible=e=>{const r=e.getBoundingClientRect();return e.isConnected&&e.checkVisibility({opacityProperty:true,visibilityProperty:true,contentVisibilityAuto:true})&&r.width>0&&r.height>0&&r.top>=0&&r.bottom<=innerHeight&&!e.closest('nav[aria-label="用户消息"],nav[aria-label="User messages"]')&&!e.matches(':disabled,[aria-disabled="true"],[data-disabled="true"]')&&(action==='primary-action'||!/^(停止|Stop)/i.test(e.getAttribute('aria-label')||''))};
 let nodes=[];
 if(action==='home')nodes=document.querySelectorAll('aside [data-sidebar-destination="builtin:home"]');
 if(action==='account')nodes=[...document.querySelectorAll('aside img')].filter(e=>{const r=e.getBoundingClientRect();return r.left<90&&r.top>innerHeight-95}).map(e=>e.closest('button')).filter(Boolean);
 if(action==='account-profile')nodes=[...document.querySelectorAll('[role="menuitem"]')].filter(e=>/^(个人资料|Profile)$/.test(e.innerText.trim()));
 if(action==='account-spaces')nodes=[...document.querySelectorAll('[role="menu"] [aria-haspopup="menu"]')].filter(e=>e.querySelector('img'));
 if(action==='attachment')nodes=document.querySelectorAll('button[aria-label="添加文件等内容"],button[aria-label^="Add files" i]');
 if(action==='send')nodes=document.querySelectorAll('[class*="ComposerLayoutRoot-"] button.bg-composer-primary');
 if(action==='primary-action')nodes=document.querySelectorAll('button.bg-composer-primary,button.size-token-button-composer.bg-codex-icon,button.size-token-button-composer[data-composer-voice-start]');
 if(action==='settings-shell')nodes=[...document.querySelectorAll('[data-spider-settings] button[aria-haspopup="menu"]')].filter(e=>/^(PowerShell|Command Prompt|Git Bash|WSL)$/.test(e.innerText.trim()));
 if(action==='settings-advanced')nodes=[...document.querySelectorAll('main button')].filter(e=>/^(高级|Advanced)$/.test(e.innerText.trim()));
 if(action==='settings-switch')nodes=[...document.querySelectorAll('main [role="switch"]')].filter(visible).slice(0,1);
 if(action==='file-row')nodes=[...document.querySelectorAll('[data-spider-diff-card] button[class*="resource-card-row-padding-x"]')].filter(e=>!e.classList.contains('rounded-b-lg')&&visible(e)).slice(-1);
 if(action==='file-more')nodes=[...document.querySelectorAll('[data-spider-diff-card] button[class~="rounded-b-lg"][class*="resource-card-row-padding-x"]')].filter(visible).slice(-1);
 if(action==='usage')nodes=document.querySelectorAll('aside button:is([aria-label="用量"],[aria-label="Usage"])');
 if(action==='permission')nodes=document.querySelectorAll('[class*="ComposerLayoutRoot-"] button[data-spider-permission-button]');
 const auditSelectors={
  'audit-sidebar':'aside button,aside [role="button"],aside [role="tab"],aside [role="combobox"]',
  'audit-settings':'main :is(button,select,[role="button"],[role="combobox"],[role="switch"],[role="checkbox"],[role="radio"],[role="tab"],[data-list-navigation-item],summary)',
  'audit-files':'[data-spider-diff-card] button',
  'audit-menus':'[data-spider-floating-surface] button,[data-spider-floating-surface] [role^="menuitem"],[data-spider-floating-surface] [role="option"],[data-spider-floating-surface] [data-list-navigation-item]',
  'audit-chat':'main :is(button,select,[role="button"],[role="combobox"],[role="tab"],summary)',
  'audit-media':'[data-spider-media-preview]',
  'audit-activity':'[data-spider-activity-hit]',
  'audit-workspace':'button,select,[role="button"],[role="combobox"],[role="switch"],[role="checkbox"],[role="radio"],[role="tab"],[role^="menuitem"],[role="option"],[data-list-navigation-item],summary'
 };
 if(action in auditSelectors){
  if(action==='audit-settings'&&document.documentElement.getAttribute('data-spider-surface')!=='settings')throw Error('Settings hover scope is not open');
  if(action==='audit-workspace'&&document.documentElement.getAttribute('data-spider-surface')!=='workspace')throw Error('Workspace hover scope is not open');
  nodes=[...document.querySelectorAll(auditSelectors[action])].filter(e=>visible(e)&&!e.closest('[data-reasoning-slider],.react-colorful'));
  const target=nodes[index];if(!target)throw Error('Hover audit target is unavailable');nodes=[target];
 }
 const matches=[...nodes].filter(visible);
 if(matches.length!==1)throw Error('Hover target is unavailable or ambiguous');
 const target=matches[0],r=target.getBoundingClientRect(),path=[];for(let e=target;e&&e!==document.body;e=e.parentElement)path.push(e.tagName+':'+[...e.parentElement.children].indexOf(e));
 return {x:r.x+r.width/2,y:r.y+r.height/2,identity:path.reverse().join('/')};
}

// The serialized action handler accepts only the names checked above.
async function inspectNativeMenu(action,value){
 const page=new URL(location.href);
 if(page.protocol!=='app:'||page.hostname!=='-'||page.pathname!=='/index.html'||page.href.toLowerCase().includes('avatar-overlay'))throw Error('Inspection is outside the native app shell');
 const available=e=>{const r=e.getBoundingClientRect();return e.isConnected&&e.checkVisibility()&&r.width>0&&r.height>0&&!e.matches(':disabled,[aria-disabled="true"]')};
 const visible=e=>{const r=e.getBoundingClientRect();return available(e)&&r.bottom>0&&r.top<innerHeight};
 const unique=(nodes)=>{const matches=[...nodes].filter(visible);if(matches.length!==1)throw Error('Menu inspection target is ambiguous or unavailable');return matches[0]};
 const composer=[...document.querySelectorAll('[class*="ComposerLayoutRoot-"],[data-codex-composer],.composer-surface-chrome')].find(visible);
 const settings=document.documentElement.getAttribute('data-spider-surface')==='settings';
 const workspace=document.documentElement.getAttribute('data-spider-surface')==='workspace'||
  (!settings&&!!composer&&!!document.querySelector('aside.app-shell-left-panel')&&!!document.querySelector('[data-app-shell-main-surface],.thread-scroll-container'));
 if(action.startsWith('search-qa-')){
  if(!workspace)throw Error('Workspace is unavailable');
  const input=unique(document.querySelectorAll('[role="dialog"][data-state="open"] input[role="combobox"]:is([placeholder="搜索 ChatGPT"],[placeholder="Search ChatGPT"])'));
  const dialog=input.closest('[role="dialog"]');
  const qaQueries={'search-qa-match':'SpiderCodex','search-qa-empty-result':'zq'+crypto.randomUUID().split('-').join('')+'vq','search-qa-reset':''};
  if(action==='search-qa-next'){
   if(document.activeElement!==input)throw Error('Search field is not focused');
   input.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',code:'ArrowDown',bubbles:true,cancelable:true}));
  }else if(action==='search-qa-scroll'){
   const list=unique(dialog.querySelectorAll('[role="listbox"]'));
   const before=list.scrollTop;
   list.scrollTo({top:list.scrollHeight,behavior:'instant'});
   return {action,invoked:true,before,after:list.scrollTop};
  }else{
   if(!Object.hasOwn(qaQueries,action)||!Object.values(qaQueries).includes(input.value)&&!/^(?:zq[0-9a-f]{32}vq|SpiderCodex-QA-[0-9a-f]{32})$/.test(input.value))throw Error('Protected search query');
   Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,qaQueries[action]);
   input.dispatchEvent(new Event('input',{bubbles:true}));
  }
  return {action,invoked:true};
 }
 if(action==='settings-list-bottom'){
  if(!settings)throw Error('Settings view is not open');
  const list=unique(document.querySelectorAll('[data-radix-popper-content-wrapper] [role="listbox"][data-spider-glass-aligned]'));
  const before=list.scrollTop;
  list.scrollTo({top:list.scrollHeight,behavior:'instant'});
  return {action,invoked:true,before,after:list.scrollTop,bottom:list.scrollHeight-list.clientHeight-list.scrollTop<2};
 }
 if(action==='media-scroll'||action==='activity-scroll'){
  const selector=action==='media-scroll'?'[data-spider-media-preview]':'[data-spider-activity-surface]';
  const target=[...document.querySelectorAll(selector)].filter(available).at(-1);if(!target)throw Error('Requested preview or activity surface is unavailable');
  target.scrollIntoView({block:'center',behavior:'instant'});return {action,invoked:true};
 }
 if(action==='sidebar-top'||action==='sidebar-down'||action==='sidebar-restore'){
  if(document.documentElement.getAttribute('data-spider-surface')!=='workspace')throw Error('Workspace sidebar is not open');
  const panes=[...document.querySelectorAll('aside [class*="overflow"]')].filter(e=>e.checkVisibility()&&e.clientWidth>100&&e.clientHeight>100&&e.scrollHeight>e.clientHeight+20);
  const pane=panes.sort((a,b)=>(b.scrollHeight-b.clientHeight)-(a.scrollHeight-a.clientHeight))[0];if(!pane)return {action,invoked:false};
  const before=pane.scrollTop;pane.scrollTo({top:action==='sidebar-restore'?value:action==='sidebar-top'?0:before+450,behavior:'instant'});return {action,invoked:true,before,after:pane.scrollTop,bottom:pane.scrollTop+pane.clientHeight>=pane.scrollHeight-2};
 }
 const scrollAction={'chat-down':450,'chat-up':-450,'chat-bottom':Infinity,'chat-scroll-check':0,'popup-down':240,'popup-up':-240,'settings-down':450,'settings-top':-Infinity};
 if(action in scrollAction){
  const scope=action.startsWith('chat-')?document.querySelectorAll('.thread-scroll-container'):action.startsWith('popup-')?document.querySelectorAll('[data-mention-list-scroll-area]'):document.querySelectorAll('main .overflow-y-auto');
  if(action.startsWith('settings-')&&!settings)throw Error('Settings view is not open');
  const areas=[...scope].filter(e=>e.checkVisibility()&&e.clientHeight>100&&e.scrollHeight>e.clientHeight+20);
  if(!areas.length)return {action,invoked:false,reason:'No scrolling needed in this pane'};
  const area=unique(areas);
  const before=area.scrollTop;
  if(action==='chat-scroll-check'){
   if(document.visibilityState!=='visible')return {action,invoked:false,reason:'Window is not visible'};
   const intervals=[];let previous,frame=0,animation=0,stopped=false,completed=false;
   const atBottom=Math.abs(area.scrollHeight-area.clientHeight-before)<3;
   try{
    await new Promise(resolve=>{
     const timeout=setTimeout(()=>{stopped=true;cancelAnimationFrame(animation);resolve()},3000);
     function tick(t){
      if(stopped)return;
      if(document.visibilityState!=='visible'||!area.isConnected){clearTimeout(timeout);resolve();return;}
      if(previous!==undefined)intervals.push(t-previous);previous=t;
      frame++;
      if(frame>60){completed=true;clearTimeout(timeout);resolve();return}
      const step=frame<31?frame:60-frame;
      area.scrollTop=Math.max(0,before-step*12);
      animation=requestAnimationFrame(tick);
     }
     animation=requestAnimationFrame(tick);
    });
   }finally{stopped=true;cancelAnimationFrame(animation);if(area.isConnected)area.scrollTop=atBottom?area.scrollHeight:before;}
   intervals.sort((a,b)=>a-b);
   return {action,invoked:true,completed,frames:intervals.length,above32:intervals.filter(ms=>ms>32).length,p95Ms:intervals[Math.floor(.95*intervals.length)]??null,maxMs:intervals.length?intervals[intervals.length-1]:null,scrollRestored:area.isConnected};
  }
  if(action==='chat-bottom')area.scrollTo({top:area.scrollHeight,behavior:'instant'});
  else if(action==='settings-top')area.scrollTo({top:0,behavior:'instant'});
  else area.scrollBy({top:scrollAction[action],behavior:'instant'});
  return {action,invoked:true,before,after:area.scrollTop};
 }
 let target;
 if(action==='open-empty-home'){
  if(!workspace||document.visibilityState!=='visible'||document.documentElement.dataset.spiderSurface!=='workspace')throw Error('Home navigation is outside the visible native workspace');
  unique([...document.querySelectorAll('aside [data-app-action-sidebar-thread-id][aria-current="page"]')].filter(e=>e.getAttribute('data-app-action-sidebar-thread-id')===value));
  if(!composer||[...composer.querySelectorAll('[contenteditable="true"],textarea')].some(e=>(e.value??e.textContent??'').trim())||composer.querySelector('img,[data-attachment-id]'))throw Error('The workspace contains an unsaved draft or attachment');
  if([...document.querySelectorAll('[role="menu"],[role="dialog"]')].some(visible))throw Error('An open popup must be preserved');
  target=unique([...document.querySelectorAll('aside button')].filter(e=>/^(新聊天|New chat)$/i.test(e.textContent.trim())));
 }
 if(action==='restore-task-thread'){
  if(document.documentElement.dataset.spiderSurface!=='workspace')throw Error('Restore is outside the native workspace');
  target=unique([...document.querySelectorAll('aside [data-app-action-sidebar-thread-id]')].filter(e=>e.getAttribute('data-app-action-sidebar-thread-id')===value));
 }
 const topMenus={'top-file':/^(文件|File)$/,'top-edit':/^(编辑|Edit)$/,'top-view':/^(视图|View)$/,'top-help':/^(帮助|Help)$/};
 if(Object.hasOwn(topMenus,action)){
  target=unique([...document.querySelectorAll('[role="menubar"] [role="menuitem"]')].filter(element=>topMenus[action].test(element.textContent.trim())));
 }
 if(action==='top-view-browser'){
  const view=[...document.querySelectorAll('[role="menubar"] [role="menuitem"][aria-expanded="true"]')].find(element=>/^(视图|View)$/.test(element.textContent.trim()));
  if(!view)throw Error('View menu must be open');
  target=unique([...document.querySelectorAll('[role="menu"] [role="menuitem"][aria-haspopup="menu"]')].filter(element=>/^(浏览器|Browser)$/.test(element.textContent.trim())));
 }
 if(action==='file-card-scroll'){
  const footers=[...document.querySelectorAll('[data-spider-diff-card] button[class~="rounded-b-lg"][class*="resource-card-row-padding-x"]')].filter(available);
  const footer=footers.at(-1);if(!footer)throw Error('File summary card is unavailable');
  footer.scrollIntoView({block:'center',behavior:'instant'});return {action,invoked:true};
 }
 if(action==='file-card-more')target=unique([...document.querySelectorAll('[data-spider-diff-card] button[class~="rounded-b-lg"][class*="resource-card-row-padding-x"]')].filter(visible).slice(-1));
 if(action==='chat-tab'){
  const tabs=[...document.querySelectorAll('[role="tab"][aria-label="聊天"],[role="tab"][aria-label="Chat"]')].filter(visible);
  if(!tabs.length&&composer&&[...document.querySelectorAll('.thread-scroll-container')].some(visible))return {action,invoked:false,reason:'Chat is already visible without a tab strip'};
  target=unique(tabs);
 }
 if(action==='attachment')target=unique((composer??document.createElement('div')).querySelectorAll('button[aria-label="添加文件等内容"],button[aria-label^="Add files" i]'));
 if(action==='workspace-usage'||action==='workspace-search'){
  if(!workspace)throw Error('Workspace is unavailable');
  const usage='aside button[aria-haspopup="menu"]:is([aria-label="用量"],[aria-label="Usage"])';
  const search='aside button[aria-haspopup="dialog"]:is([aria-label="搜索"],[aria-label="Search"])';
  target=unique(document.querySelectorAll(action==='workspace-usage'?usage:search));
 }
 if(action==='workspace-projects-fold'||action==='workspace-recent-fold'||action==='workspace-projects-menu'){
  if(!workspace)throw Error('Workspace is unavailable');
  if(action==='workspace-projects-menu'){
   target=unique(document.querySelectorAll('aside button[aria-haspopup="menu"]:is([aria-label="项目侧边栏选项"],[aria-label="Project sidebar options"])'));
  }else{
   const name=action==='workspace-projects-fold'?/^(项目|Projects)$/:/^(最近|Recent)$/;
   target=unique([...document.querySelectorAll('aside button[aria-expanded][class~="group/section-toggle"]')].filter(e=>name.test(e.textContent.trim())));
  }
 }
 if(action==='workspace-projects-organize'||action==='workspace-projects-sort'){
  if(!workspace)throw Error('Workspace is unavailable');
  const trigger=unique(document.querySelectorAll('aside button[aria-expanded="true"]:is([aria-label="项目侧边栏选项"],[aria-label="Project sidebar options"])'));
  const menu=document.getElementById(trigger.getAttribute('aria-controls'));
  const name=action==='workspace-projects-organize'?/^(整理侧边栏|Organize sidebar)$/:/^(聊天排序方式|Chat sort order|Sort chats)$/;
  target=unique([...(menu?.querySelectorAll('[role="menuitem"][aria-haspopup="menu"]')??[])].filter(e=>name.test(e.textContent.trim())));
 }
 if(action==='composer-permission'){
  if(!composer)throw Error('Workspace composer is unavailable');
  target=unique(composer.querySelectorAll('button[data-spider-permission-button]:is([aria-haspopup="menu"],[aria-haspopup="listbox"])'));
 }
 if(action==='model')target=unique([...(composer?.querySelectorAll('button[aria-haspopup="menu"]')??[])].filter(e=>!e.closest('[role="menu"],[data-spider-floating-surface]')&&!e.getAttribute('aria-label')&&/GPT|Sol|Astra|选择推理强度|Select reasoning|Choose model/i.test(e.textContent)));
 if(action==='model-list')target=unique(document.querySelectorAll('[role="menu"] [data-model-picker-view-toggle]'));
 if(action==='model-focus-slider'){
  target=unique(document.querySelectorAll('[role="menu"] [data-reasoning-slider]'));
  target.focus({focusVisible:true});return {action,invoked:true,focusOnly:true};
 }
 if(action==='account'){
  const marked=[...document.querySelectorAll('aside button[data-spider-avatar-button][aria-haspopup="menu"]')].filter(visible);
  const legacy=[...new Set([...document.querySelectorAll('aside img')].filter(e=>{
   const box=e.getBoundingClientRect();return box.left<90&&box.top>innerHeight-95;
  }).map(e=>e.closest('button[aria-haspopup="menu"]')).filter(Boolean))];
  target=unique(marked.length?marked:legacy);
 }
 if(action==='account-spaces')target=unique([...document.querySelectorAll('[role="menu"] [aria-haspopup="menu"]')]
  .filter(e=>e.querySelector('img')&&e.checkVisibility({opacityProperty:true,visibilityProperty:true})));
 if(action==='settings')target=unique([...document.querySelectorAll('[role="menuitem"]')].filter(e=>/^(设置|Settings)(?:\s|Ctrl|⌘|$)/.test(e.textContent.trim())));
 if(action==='settings-back'){
  if(!settings)throw Error('Settings view is not open');
  const direct=[...document.querySelectorAll('button[aria-label="返回 ChatGPT"],button[aria-label="返回 Codex"],button[aria-label="Back to ChatGPT"],button[aria-label="Back to Codex"]')].filter(visible);
  target=direct.length?unique(direct):unique(document.querySelectorAll('main button[aria-label^="返回"],main button[aria-label^="Back to"],[class*="ApplicationMenuTopBar-"] button[aria-label="返回"],[class*="ApplicationMenuTopBar-"] button[aria-label="Back"]'));
 }
 if(action==='appearance-advanced'){
  if(!settings)throw Error('Settings view is not open');
  target=unique([...document.querySelectorAll('main button,main [role="button"]')].filter(e=>/^(高级|Advanced)$/.test(e.innerText.trim())));
 }
 if(action==='appearance-code-themes')target=unique([...document.querySelectorAll('[role="menu"] [aria-haspopup="menu"]')].filter(e=>/Codex\s*主题|Codex themes/i.test(e.innerText)));
 const settingsPages={
  'settings-import':'导入','settings-account':'账户','settings-archives':'已归档的聊天',
  'settings-voice':'语音','settings-storage':'存储','settings-personalization':'个性化',
  'settings-companions':'迷你界面和智能伙伴','settings-shortcuts':'键盘快捷键','settings-usage':'使用情况和计费',
  'settings-data':'数据管理','settings-plugins':'插件','settings-snapshots':'应用快照','settings-browser':'浏览器',
  'settings-cloud':'云电脑','settings-connections':'连接','settings-codex-cloud':'Codex 云端',
  'settings-review':'代码审查','settings-git':'Git','settings-worktrees':'Worktrees'
 };
 if(action in settingsPages){
  if(!settings)throw Error('Settings view is not open');
  const tabs=[...document.querySelectorAll('aside button.sidebar-item')].filter(e=>available(e)&&e.innerText.trim()===settingsPages[action]);
  if(tabs.length!==1)throw Error('Settings page is ambiguous or unavailable');
  tabs[0].scrollIntoView({block:'nearest',behavior:'instant'});
  target=unique(tabs);
 }
 if(action==='inspection-dismiss'){
  target=unique(document.querySelectorAll('[role="dialog"] button[aria-label="关闭"],[role="dialog"] button[aria-label="Close"],[role="dialog"] button[aria-label="取消"],[role="dialog"] button[aria-label="Cancel"]'));
 }
 if(['general','appearance','notifications'].includes(action)){
  if(!settings)throw Error('Settings view is not open');
  const names={general:/^(常规|General)$/,appearance:/^(外观|Appearance)$/,notifications:/^(通知|Notifications)$/};
  const dialogs=[...document.querySelectorAll('[role="dialog"].settings-dialog')].filter(e=>visible(e)&&e.querySelector('.settings-dialog-nav-list'));
  if(dialogs.length>1)throw Error('Settings dialog is ambiguous');
  const navigation=dialogs.length?[...dialogs[0].querySelectorAll('.settings-dialog-nav-list :is(button,a,[role="tab"])')]:
    [...document.querySelectorAll('aside button.sidebar-item')];
  const matches=navigation.filter(e=>available(e)&&names[action].test(e.textContent.trim()));
  const tabs=matches.length?matches:[...document.querySelectorAll('main button,main [role="tab"],main a')].filter(e=>available(e)&&names[action].test(e.textContent.trim()));
  if(tabs.length!==1)throw Error('Settings section is ambiguous or unavailable');
  tabs[0].scrollIntoView({block:'nearest',behavior:'instant'});
  target=unique(tabs);
 }
 const fields={
  'general-shell':/^(集成终端 Shell|Integrated terminal Shell)$/,
  'general-language':/^(语言|Language)$/,
  'general-open-location':/^(默认文件打开位置|Default file open location)$/,
  'general-environment':/^(智能体环境|Agent environment)$/,
  'general-close-confirm':/^(关闭窗口前确认|Confirm before closing)$/,
  'general-auto-archive':/^(自动归档不活跃的聊天|Auto-archive inactive chats)$/,
  'general-speed':/^(速度|Speed)$/,
  'general-reasoning':/^(可用推理强度|Available reasoning levels)$/,
  'general-send-shortcut':/^(发送快捷键|Send shortcut)$/,
  'general-notification-mode':/^(轮次完成通知|Turn completion notifications)$/,
  'general-notification-sound':/^(通知提示音|Notification sound)$/,
  'notification-mode':/^(Codex|轮次完成通知|Turn completion notifications)$/,
  'notification-personalization':/^(个性化提示|Personalized suggestions)$/,
  'notification-tasks':/^(任务|Tasks)$/,
  'notification-usage':/^(使用情况|Usage)$/,
  'notification-health':/^(健康|Health)$/,
  'notification-replies':/^(回复|Replies)$/,
  'notification-groups':/^(群聊|Group chats)$/,
  'notification-marketing':/^(营销|Marketing)$/,
  'notification-library':/^(资料库|Library)$/,
  'notification-projects':/^(项目|Projects)$/,
  'appearance-font':/^(字体|Font)$/,
  'appearance-content-font':/^(内容字体|Content font)$/,
  'appearance-code-font':/^(代码字体|Code font)$/,
  'appearance-background':/^(背景|Background)$/,
  'appearance-foreground':/^(前景|Foreground)$/,
  'appearance-theme':/^(主题|Theme)$/,
  'appearance-accent':/^(强调色|Accent color)$/
 };
 if(action in fields){
  if(!settings)throw Error('Settings view is not open');
  const labels=[...document.querySelectorAll('[data-spider-glass-panel] label,[data-spider-glass-panel] span,[data-spider-glass-panel] div')].filter(e=>available(e)&&fields[action].test(e.innerText.trim()));
  const label=labels.sort((a,b)=>a.querySelectorAll('*').length-b.querySelectorAll('*').length)[0];
  for(let row=label;row&&row.tagName!=='MAIN';row=row.parentElement){
   const controls=[...row.querySelectorAll('button[aria-haspopup],[role="combobox"]')].filter(e=>available(e)&&!/^导入|^Import|^上传|^Upload/.test(e.getAttribute('aria-label')||''));
   if(controls.length===1){target=controls[0];break}
   if(controls.length>1)throw Error('Setting field is ambiguous');
  }
 }
 if(!target||target.closest('[contenteditable="true"],textarea')||target.matches('button.bg-composer-primary'))throw Error('Protected control');
 if(action in fields&&!visible(target))target.scrollIntoView({block:'nearest',behavior:'instant'});
 const wasOpen=target.matches('[data-state="open"],[aria-expanded="true"]');
 if(action==='account'){
  target.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0,buttons:1,pointerType:'mouse'}));
  target.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,button:0,pointerType:'mouse'}));
 }else{
  target.click();
  if(target.matches('[aria-haspopup="menu"],[aria-haspopup="listbox"]')){
   await new Promise(resolve=>setTimeout(resolve,60));
   const stillNeedsToggle=wasOpen?target.matches('[data-state="open"],[aria-expanded="true"]'):target.matches('[data-state="closed"],[aria-expanded="false"]');
   if(visible(target)&&stillNeedsToggle){
    target.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0,buttons:1,pointerType:'mouse'}));
    target.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,button:0,pointerType:'mouse'}));
   }
  }
 }
 return {action,invoked:true};
}
