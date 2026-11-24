import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {parseLayoutRepair} from './layout-repair.mjs';

function validWebp(bytes){
  return bytes.length>=16&&bytes.length<=2*1024*1024&&bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP';
}

export async function readPreparedGlass(assetDirectory,original){
  try{
    const recipe=JSON.parse(await fs.readFile(path.join(assetDirectory,'client-glass-textures.json'),'utf8'));
    if(recipe.version!==1||recipe.sourceSha256!==createHash('sha256').update(original).digest('hex'))return null;
    const [frost,clear]=await Promise.all([
      fs.readFile(path.join(assetDirectory,'client-glass-frost.webp')),
      fs.readFile(path.join(assetDirectory,'client-glass-clear.webp'))
    ]);
    if(!validWebp(frost)||!validWebp(clear)||
      recipe.frostSha256!==createHash('sha256').update(frost).digest('hex')||
      recipe.clearSha256!==createHash('sha256').update(clear).digest('hex'))return null;
    return {frost:'data:image/webp;base64,'+frost.toString('base64'),clear:'data:image/webp;base64,'+clear.toString('base64')};
  }catch{return null;}
}

export async function themeConfig(releaseRoot,original){
  const preparedGlass=await readPreparedGlass(path.join(releaseRoot,'assets'),original);
  let layoutRepair=null;
  try{layoutRepair=parseLayoutRepair(JSON.parse(process.env.SPIDERCODEX_LAYOUT_REPAIR??'null'),process.env.SPIDERCODEX_OFFICIAL_VERSION);}catch{}
  return {wallpaper:'data:image/png;base64,'+original.toString('base64'),referenceBackground:true,preparedGlass,layoutRepair};
}
