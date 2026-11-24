import {writeFile,rename,unlink} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';

const attribute = /^data-[a-z][a-z0-9-]{1,63}$/;
export function parseLayoutRepair(value, officialVersion){
  if(!value||value.version!==officialVersion||!/^\d+(?:\.\d+){3}$/.test(officialVersion??'')||
     typeof value.mainAttribute!=='string'||typeof value.composerAttribute!=='string'||
     !attribute.test(value.mainAttribute??'')||!attribute.test(value.composerAttribute??'')||
     value.mainAttribute===value.composerAttribute)return null;
  return {mainAttribute:value.mainAttribute,composerAttribute:value.composerAttribute};
}

export function observeLayout(){
  const root=document.getElementById('root');
  const visible=node=>!!node?.checkVisibility()&&node.getBoundingClientRect().width>0;
  if(!root||![...root.querySelectorAll('aside.app-shell-left-panel nav[class*="group/sidebar-rail"]')].some(visible))return [];
  const data=node=>node.getAttributeNames().filter(name=>/^data-[a-z][a-z0-9-]{1,63}$/.test(name)).slice(0,8);
  const pairs=[];
  for(const main of [...root.querySelectorAll('main')].filter(visible).slice(0,4)){
    for(const input of [...main.querySelectorAll('textarea,[contenteditable="true"][role="textbox"]')].filter(visible).slice(0,3)){
      const attrs=[];
      for(let node=input,depth=0;node&&node!==main&&depth<4;node=node.parentElement,depth++)attrs.push(...data(node));
      for(const mainAttribute of data(main)){
        for(const composerAttribute of new Set(attrs)){
          if(mainAttribute!==composerAttribute&&!pairs.some(x=>x.mainAttribute===mainAttribute&&x.composerAttribute===composerAttribute))
            pairs.push({mainAttribute,composerAttribute});
        }
      }
    }
  }
  return pairs.slice(0,20);
}

export async function saveLayoutObservation(pairs){
  const version=process.env.SPIDERCODEX_OFFICIAL_VERSION;
  if(process.env.SPIDERCODEX_REPAIR_OBSERVATION!=='1'||!/^\d+(?:\.\d+){3}$/.test(version??'')||
    !Array.isArray(pairs)||!pairs.length||!process.env.LOCALAPPDATA)return;
  const target=path.join(process.env.LOCALAPPDATA,'SpiderCodex','layout-observation.json');
  const safe=pairs.slice(0,20).map(x=>parseLayoutRepair({...x,version},version)).filter(Boolean);
  if(!safe.length)return;
  const staged=target+'.'+randomUUID()+'.tmp';
  try{
    await writeFile(staged,JSON.stringify({version,at:new Date().toISOString(),pairs:safe}),{flag:'wx'});
    await rename(staged,target);
  }finally{await unlink(staged).catch(()=>{});}
}
