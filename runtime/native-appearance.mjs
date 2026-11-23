import fs from 'node:fs/promises';import path from 'node:path';
const pause=ms=>new Promise(r=>setTimeout(r,ms));
export async function setNativeAppearance({call,evaluate},desired,{port=9341,recordOriginal=true,returnToMain=true}={}){
 if(!['dark','light','system'].includes(desired))throw Error('Invalid native appearance');
 const backupPath=path.join(process.env.LOCALAPPDATA,'SpiderCodex',`appearance-native-${port}.json`);
 const point=async expression=>evaluate(`(()=>{const e=${expression};if(!e)return null;const r=e.getBoundingClientRect();window.__SPIDER_APPEARANCE_TARGET__=e;return r.width>0?{x:r.x+r.width/2,y:r.y+r.height/2}:null})()`);
 const click=async p=>{if(!p)throw Error('Native appearance control unavailable');await evaluate(`(()=>{const e=window.__SPIDER_APPEARANCE_TARGET__;if(!e?.isConnected)throw Error('Appearance control changed');e.click();return true})()`);};
 const wait=async expression=>{for(let i=0;i<35;i++){if(await evaluate(expression))return;await pause(70)}throw Error('Native appearance view timed out');};
 const mainReady=`!![...document.querySelectorAll('[data-codex-composer],.composer-surface-chrome,[class*="ComposerLayoutRoot-"]')].find(e=>e.checkVisibility()&&e.getBoundingClientRect().width>0)`;
 const returnMainView=async()=>{
  if(await evaluate(mainReady))return;
  for(let attempt=0;attempt<3;attempt++){
   const back=await point(`[...document.querySelectorAll('button')].find(e=>/^(返回 ChatGPT|Back to ChatGPT|返回 Codex|Back to Codex|返回|Back)$/.test(e.getAttribute('aria-label')||e.textContent.trim())&&e.checkVisibility()&&!e.disabled&&e.getBoundingClientRect().width>0)`);
   if(back)await click(back);
   try{await wait(mainReady);return}catch(error){const stillSettings=await evaluate(`[...document.querySelectorAll('h1')].some(e=>e.checkVisibility()&&/^(设置|Settings)$/.test(e.textContent.trim()))`);if(!stillSettings||!back)throw error;}
  }
  throw Error('Native main view did not return from Settings');
 };
 const radioPresent=await evaluate(`!![...document.querySelectorAll('input[name="appearance-theme"]')].find(e=>e.closest('label')?.checkVisibility()&&e.closest('label').getBoundingClientRect().width>0)`);
 const initialDark=await evaluate(`matchMedia('(prefers-color-scheme:dark)').matches`);
 if(desired==='dark'&&initialDark&&!radioPresent){if(returnToMain)await returnMainView();await evaluate('delete window.__SPIDER_APPEARANCE_TARGET__');return {changed:false,nativeDark:true};}
 const savedThread=await evaluate(`document.querySelector('aside [data-app-action-sidebar-thread-selected="true"]')?.getAttribute('data-app-action-sidebar-thread-id')||null`);
 if(!radioPresent){
  const appearance=await point(`[...document.querySelectorAll('button')].find(e=>/^(外观|Appearance)$/.test(e.textContent.trim())&&e.checkVisibility()&&e.getBoundingClientRect().width>0)`);
  if(!appearance){
   const avatar=await point(`[...document.querySelectorAll('aside img')].find(e=>{const r=e.getBoundingClientRect();return e.checkVisibility()&&r.width>0&&r.y>innerHeight-90&&r.x<70})?.closest('button')`);if(!avatar)throw Error('Native account menu unavailable');await evaluate(`(()=>{const e=window.__SPIDER_APPEARANCE_TARGET__;e.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0,buttons:1,pointerType:'mouse'}));e.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,button:0,pointerType:'mouse'}));return true})()`);await pause(50);if(!await evaluate(`!![...document.querySelectorAll('[role=menuitem]')].find(e=>/^(设置|Settings)/.test(e.textContent.trim())&&e.checkVisibility()&&e.getBoundingClientRect().width>0)`))await click(avatar);
   await wait(`!![...document.querySelectorAll('[role=menuitem]')].find(e=>/^(设置|Settings)/.test(e.textContent.trim())&&e.checkVisibility()&&e.getBoundingClientRect().width>0)`);
   await click(await point(`[...document.querySelectorAll('[role=menuitem]')].find(e=>/^(设置|Settings)/.test(e.textContent.trim())&&e.checkVisibility()&&e.getBoundingClientRect().width>0)`));
   await wait(`!![...document.querySelectorAll('button')].find(e=>/^(外观|Appearance)$/.test(e.textContent.trim())&&e.checkVisibility()&&e.getBoundingClientRect().width>0)`);
  }
  await click(await point(`[...document.querySelectorAll('button')].find(e=>/^(外观|Appearance)$/.test(e.textContent.trim())&&e.checkVisibility()&&e.getBoundingClientRect().width>0)`));await wait(`!!document.querySelector('input[name="appearance-theme"]')`);
 }
 const labelToKey={系统:'system',System:'system',浅色:'light',Light:'light',深色:'dark',Dark:'dark'};
 const checkedLabel=await evaluate(`[...document.querySelectorAll('input[name="appearance-theme"]:checked')].find(e=>e.closest('label')?.checkVisibility()&&e.closest('label').getBoundingClientRect().width>0)?.getAttribute('aria-label')`);const original=labelToKey[checkedLabel];if(!original)throw Error('Native appearance baseline could not be identified');
 if(recordOriginal&&original!==desired){const prior=await fs.readFile(backupPath,'utf8').then(JSON.parse).catch(()=>null);if(!prior?.active||original!== 'dark')await fs.writeFile(backupPath,JSON.stringify({active:true,original,applied:desired,scope:'Native app appearanceTheme only',configPath:path.join(process.env.CODEX_HOME||path.join(process.env.USERPROFILE,'.codex'),'config.toml'),configKey:'desktop.appearanceTheme'}));}
 if(original!==desired){
  const labels=Object.entries(labelToKey).filter(([,v])=>v===desired).map(([k])=>k);
  await click(await point(`[...document.querySelectorAll('input[name="appearance-theme"]')].find(e=>${JSON.stringify(labels)}.includes(e.getAttribute('aria-label'))&&e.closest('label')?.checkVisibility()&&e.closest('label').getBoundingClientRect().width>0)?.closest('label')`));
  await wait(`!![...document.querySelectorAll('input[name="appearance-theme"]')].find(e=>${JSON.stringify(labels)}.includes(e.getAttribute('aria-label'))&&e.checked&&e.closest('label')?.checkVisibility()&&e.closest('label').getBoundingClientRect().width>0)`);
  if(desired==='dark')await wait(`matchMedia('(prefers-color-scheme:dark)').matches`);await pause(100);
 }
 const nativeDark=await evaluate(`matchMedia('(prefers-color-scheme:dark)').matches`);
 if(returnToMain){
  await returnMainView();
  if(savedThread){const p=await point(`[...document.querySelectorAll('aside [data-app-action-sidebar-thread-id]')].find(e=>e.getAttribute('data-app-action-sidebar-thread-id')===${JSON.stringify(savedThread)})`);if(p)await click(p);}
  await wait(mainReady);
 }
 if(!recordOriginal){const prior=await fs.readFile(backupPath,'utf8').then(JSON.parse).catch(()=>null);if(prior)await fs.writeFile(backupPath,JSON.stringify({...prior,active:false}));}
 await evaluate('delete window.__SPIDER_APPEARANCE_TARGET__');return {changed:original!==desired,previous:original,current:desired,nativeDark};
}
