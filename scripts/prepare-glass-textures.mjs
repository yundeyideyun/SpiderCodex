import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdtemp,readFile,realpath,rename,rm,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import os from 'node:os';

const [browser]=process.argv.slice(2);
if(!browser)throw Error('Pass the Chromium executable used to prepare project artwork.');
const root=fileURLToPath(new URL('../',import.meta.url));
const folder=path.join(root,'assets');
const [source,theme]=await Promise.all([
  readFile(path.join(folder,'client-brighter.png')),
  readFile(path.join(root,'runtime','spider-theme.js'),'utf8')
]);
const textures=new Map();
let complete;
const received=new Promise(resolve=>{complete=resolve;});
const html=`<!doctype html><meta charset="utf-8"><main id="root"></main>
<script type="module">
import install from '/theme.mjs';
install({wallpaper:'/wallpaper.png',referenceBackground:true});
const state=window.__SPIDER_CODEX_V3__.artworkCache;
for(let i=0;i<140&&(!state.frostUrl||!state.clearUrl);i++)await new Promise(resolve=>setTimeout(resolve,55));
for(const [kind,url] of [['frost',state.frostUrl],['clear',state.clearUrl]]){
  if(!url)throw Error('Artwork preparation did not finish');
  const blob=await fetch(url).then(response=>response.blob());
  const response=await fetch('/texture/'+kind,{method:'POST',body:blob});
  if(!response.ok)throw Error('Artwork was not received');
}
document.body.dataset.done='true';
</script>`;
const server=createServer(async(req,res)=>{
  if(req.method==='GET'&&req.url==='/')return res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'}).end(html);
  if(req.method==='GET'&&req.url==='/theme.mjs')return res.writeHead(200,{'Content-Type':'text/javascript; charset=utf-8'}).end('export default '+theme);
  if(req.method==='GET'&&req.url==='/wallpaper.png')return res.writeHead(200,{'Content-Type':'image/png'}).end(source);
  if(req.method==='POST'&&['/texture/frost','/texture/clear'].includes(req.url)){
    const chunks=[];let size=0;
    for await(const chunk of req){size+=chunk.length;if(size>2*1024*1024){res.writeHead(413).end();return;}chunks.push(chunk);}
    const bytes=Buffer.concat(chunks);
    if(bytes.toString('ascii',0,4)!=='RIFF'||bytes.toString('ascii',8,12)!=='WEBP')return res.writeHead(400).end();
    textures.set(req.url.split('/').at(-1),bytes);
    res.writeHead(204).end();
    if(textures.size===2)complete();
    return;
  }
  res.writeHead(404).end();
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const temporaryDirectory=await realpath(os.tmpdir());
const profile=await mkdtemp(path.join(temporaryDirectory,'spider-glass-bake-'));
let child,exited,clock;
try{
  child=spawn(browser,[
    '--headless','--no-first-run','--no-default-browser-check','--disable-background-networking','--disable-extensions',
    '--user-data-dir='+profile,'http://127.0.0.1:'+server.address().port+'/'
  ],{windowsHide:true,stdio:'ignore'});
  exited=new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',resolve);});
  await Promise.race([received,exited.then(()=>{throw Error('Chromium exited before preparing both textures');}),
    new Promise((_,reject)=>{clock=setTimeout(()=>reject(Error('Chromium texture preparation timed out')),18000);})]);
  const files=['frost','clear'];
  const metadata={version:1,sourceSha256:createHash('sha256').update(source).digest('hex')};
  for(const kind of files){
    const filename=path.join(folder,'client-glass-'+kind+'.webp');
    const bytes=textures.get(kind);
    metadata[kind+'Sha256']=createHash('sha256').update(bytes).digest('hex');
    await writeFile(filename+'.pending',bytes);
    await rename(filename+'.pending',filename);
  }
  await writeFile(path.join(folder,'client-glass-textures.json.pending'),JSON.stringify(metadata,null,2)+'\n');
  await rename(path.join(folder,'client-glass-textures.json.pending'),path.join(folder,'client-glass-textures.json'));
  console.log(JSON.stringify({assets:files.map(kind=>({kind,bytes:textures.get(kind).length})),wallpaperSha256:metadata.sourceSha256}));
}finally{
  clearTimeout(clock);
  if(child&&child.exitCode===null)child.kill();
  await exited?.catch(()=>{});
  server.close();
  const resolved=await realpath(profile);
  if(path.dirname(resolved)===temporaryDirectory&&path.basename(resolved).startsWith('spider-glass-bake-'))
    await rm(resolved,{recursive:true,maxRetries:4,retryDelay:100});
}
