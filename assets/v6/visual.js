const RENDERER_REVISION='20261122-foreground-silk';
import {AlphaVideo} from './alpha-video.js?rev=20261118-display-layout';
import {canvasResolution,sceneScale,normalizedScreenWidth} from './scene-geometry.mjs';
const assetUrl=url=>{const result=new URL(url,location.href);result.searchParams.set('rev',RENDERER_REVISION);return result.href};
const clamp=x=>Math.max(0,Math.min(1,x));
const smooth=x=>{x=clamp(x);return x*x*(3-2*x)};
const TITLE_FADE_START=5.80,TITLE_VISIBLE=6.10,EXIT_FADE_START=8.18,BOOT_END=8.25;
const FULL_SCENE=[0,0,1920,1080];
async function image(url){const value=new Image();value.src=assetUrl(url);await value.decode();return value}
async function video(url){
 const value=document.createElement('video');value.muted=true;value.playsInline=true;value.preload='auto';value.src=assetUrl(url);value.style.cssText='position:fixed;width:1px;height:1px;opacity:0;pointer-events:none';document.body.append(value);
 await new Promise((resolve,reject)=>{value.addEventListener('loadeddata',resolve,{once:true});value.addEventListener('error',()=>reject(Error('Effect video did not load: '+url)),{once:true});value.load()});return value;
}
export class ReferenceVisual {
 static async create(canvas,notify){
  const [base,eyes,title,workspace,meta,web,second,shot,rings,ringMeta,red,redMeta]=await Promise.all([image('v5/mask-base.png'),image('v5/mask-eyes.png'),image('v5/title-spiderman.png'),image('v5/title-workspace.png'),fetch(assetUrl('v5/reference-ui.json')).then(r=>r.json()),video('v5/web-screen.mp4'),video('v5/web-screen.mp4'),video('v5/shot-screen.mp4'),image('v5/rings.png'),fetch(assetUrl('v5/rings-source.json')).then(r=>r.json()),video('v6/red-collapse.mp4'),fetch(assetUrl('v6/red-collapse.json')).then(r=>r.json())]);
  const [redColor,foreground]=await Promise.all([
   redMeta.colorMode==='rgb-video'?video('v6/red-color.mp4'):null,
   meta.foregroundSilkBox?video('v6/foreground-silk.mp4'):null
  ]);
  return new ReferenceVisual(canvas,notify,{base,eyes,title,workspace,meta,web,second,shot,rings,ringMeta,red,redMeta,redColor,foreground});
 }
 constructor(canvas,notify,assets){this.canvas=canvas;this.ctx=canvas.getContext('2d',{alpha:true,desynchronized:true});this.silk=document.createElement('canvas');this.silk.id='silk';canvas.before(this.silk);this.silkCtx=this.silk.getContext('2d',{alpha:true,desynchronized:true});this.notify=notify;this.assets=assets;this.redRenderer=new AlphaVideo(assets.red,assets.redMeta.colorRGB,assets.redMeta.fps||30);
  const layer=()=>{const value=document.createElement('canvas');value.width=assets.base.width;value.height=assets.base.height;return value};
  const darkLens=layer(),darkContext=darkLens.getContext('2d');darkContext.drawImage(assets.eyes,0,0);darkContext.globalCompositeOperation='source-in';darkContext.fillStyle='#150d18';darkContext.fillRect(0,0,darkLens.width,darkLens.height);
  this.baseDark=layer();const baseContext=this.baseDark.getContext('2d');baseContext.drawImage(assets.base,0,0);baseContext.drawImage(darkLens,0,0);
  this.pinkEyes=layer();const pinkContext=this.pinkEyes.getContext('2d');pinkContext.drawImage(assets.eyes,0,0);pinkContext.globalCompositeOperation='source-in';pinkContext.fillStyle='#ad415e';pinkContext.fillRect(0,0,this.pinkEyes.width,this.pinkEyes.height);
  this.effects=[];this.raf=0;this.boot=null;this.resize();}
 resize(){
  this.width=innerWidth;this.height=innerHeight;
  const resolution=canvasResolution(this.width,this.height,devicePixelRatio);
  for(const [canvas,context] of [[this.canvas,this.ctx],[this.silk,this.silkCtx]]){
   if(canvas.width!==resolution.pixelWidth)canvas.width=resolution.pixelWidth;
   if(canvas.height!==resolution.pixelHeight)canvas.height=resolution.pixelHeight;
   context.setTransform(resolution.scaleX,0,0,resolution.scaleY,0,0);
   context.imageSmoothingQuality='high';
  }
  // Resizing clears the bitmap even when the title is waiting for the client.
  if(this.boot?.holdStarted!=null){
   this.ctx.clearRect(0,0,this.width,this.height);
   this.silkCtx.clearRect(0,0,this.width,this.height);
   this.drawBoot(7.5,this.boot);
  }
  if(this.boot?.titleShown)this.notifyTitle();
 }

 clear(){this.effects=[];cancelAnimationFrame(this.raf);this.raf=0;this.ctx.clearRect(0,0,this.width,this.height);this.silkCtx.clearRect(0,0,this.width,this.height);for(const item of [this.assets.web,this.assets.second,this.assets.shot,this.assets.red,this.assets.redColor,this.assets.foreground].filter(Boolean))item.pause();}
 request(){if(!this.raf)this.raf=requestAnimationFrame(now=>this.frame(now));}
 async play(value){value.currentTime=0;try{await value.play()}catch(error){if(error?.name!=='AbortError')throw error;}}
 click(u,v,screenWidthRatio=1){
  if(this.boot)return this.enter(u,v);const now=performance.now();let value=[this.assets.web,this.assets.second].find(video=>!this.effects.some(e=>e.video===video));
  if(!value){const removed=this.effects.shift();value=removed.video;value.pause()}
  this.effects.push({video:value,born:now,u,v,screenWidthRatio:normalizedScreenWidth(screenWidthRatio)});this.play(value).catch(error=>this.notify({kind:'error',message:error.message}));this.request();
 }
 mediaCounters(){
  const counters={};
  for(const name of ['shot','web','red','redColor','foreground']){
   const quality=this.assets[name]?.getVideoPlaybackQuality?.();
   if(quality)counters[name]={total:quality.totalVideoFrames,dropped:quality.droppedVideoFrames};
  }
  return counters;
 }
 mediaSince(baseline){
  const counters=this.mediaCounters();
  for(const [name,value] of Object.entries(counters)){
   value.total-=baseline[name].total;value.dropped-=baseline[name].dropped;
  }
  return counters;
 }
 begin(request){
  this.clear();this.boot={...request,mediaBaseline:this.mediaCounters(),born:performance.now(),clientReady:false,holdStarted:null,held:0,frames:0,drawMs:0,last:0};
  this.play(this.assets.shot).catch(error=>this.notify({kind:'error',message:error.message}));this.assets.web.currentTime=0;this.assets.web.pause();this.boot.webStarted=false;this.assets.red.currentTime=0;this.assets.red.pause();if(this.assets.redColor){this.assets.redColor.currentTime=0;this.assets.redColor.pause()}this.boot.redStarted=false;
  if(this.assets.foreground){this.assets.foreground.currentTime=0;this.assets.foreground.pause();}
  this.request();
 }
 ready(){if(this.boot){this.boot.clientReady=true;this.request()}}
 titleBounds(){
  const boot=this.boot;
  if(!boot)return null;
  const scale=sceneScale(this.width,boot.screenWidthRatio);
  const [left,top,width,height]=this.assets.meta.titleBox;
  const pad=7;
  return {
   u:(boot.mask[0]*this.width+(left-947-pad)*scale)/this.width,
   v:(boot.mask[1]*this.height+(top-518-pad)*scale)/this.height,
   width:(width+pad*2)*scale/this.width,
   height:(height+pad*2)*scale/this.height,
  };
 }
 notifyTitle(){
  this.notify({kind:'bootTitleVisible',id:this.boot.id,box:this.titleBounds()});
 }
 enter(u,v){
  const boot=this.boot;
  if(!boot?.titleShown||!Number.isFinite(u)||!Number.isFinite(v))return false;
  const box=this.titleBounds();
  if(u<box.u||u>box.u+box.width||v<box.v||v>box.v+box.height)return false;
  if(!boot.enterRequested){
   boot.enterRequested=true;
   this.notify({kind:'bootEnterRequested',id:boot.id,clientReady:boot.clientReady});
  }
  this.request();
  return true;
 }
 abort(){this.boot=null;this.clear();}
 drawWeb(value,u,v,screenWidthRatio=1,opacity=1,reflection=.18,box=FULL_SCENE){
  if(value.readyState<2)return;const ctx=this.silkCtx,s=sceneScale(this.width,screenWidthRatio);
  const [left,top,width,height]=box;
  const destination=[u*this.width+(left-946)*s,v*this.height+(top-432)*s,width*s,height*s];
  ctx.save();ctx.globalCompositeOperation='screen';ctx.globalAlpha=opacity;ctx.drawImage(value,...destination);
  if(reflection>0){ctx.globalAlpha=reflection*opacity;ctx.drawImage(value,...destination);}
  ctx.restore();
 }
 drawShot(origin,target,screenWidthRatio=1){
  const value=this.assets.shot;if(value.readyState<2)return;
  const from={x:origin[0]*this.width,y:origin[1]*this.height},to={x:target[0]*this.width,y:target[1]*this.height};
  const sx=946-453,sy=432-480,sourceLength=Math.hypot(sx,sy),dx=to.x-from.x,dy=to.y-from.y,length=Math.hypot(dx,dy);
  if(length<1)return;const ux=sx/sourceLength,uy=sy/sourceLength,vx=-uy,vy=ux,tx=dx/length,ty=dy/length,nx=-ty,ny=tx,along=length/sourceLength,across=sceneScale(this.width,screenWidthRatio);
  const a=tx*along*ux+nx*across*vx,b=ty*along*ux+ny*across*vx,c=tx*along*uy+nx*across*vy,d=ty*along*uy+ny*across*vy;
  const ctx=this.silkCtx;ctx.save();ctx.globalCompositeOperation='screen';ctx.transform(a,b,c,d,from.x-a*453-c*480,from.y-b*453-d*480);ctx.drawImage(value,420,400,580,150);ctx.globalAlpha=.4;ctx.drawImage(value,420,400,580,150);ctx.restore();
 }
 drawMask(t,mask,fade,screenWidthRatio=1){
  const appear=smooth((t-3.60)/.45);if(appear<=0)return;const s=sceneScale(this.width,screenWidthRatio)*(.70+.30*appear),x=mask[0]*this.width,y=mask[1]*this.height,ctx=this.ctx,meta=this.assets.meta;
  ctx.save();ctx.globalAlpha=appear*fade;ctx.translate(x,y);ctx.scale(s,s);ctx.translate(-947,-518);
  const box=meta.maskBox;
  // Let the web pattern read through the red glow before the lenses brighten.
  ctx.save();ctx.globalAlpha*=smooth((t-3.64)/.21);ctx.drawImage(this.baseDark,...box);ctx.restore();
  // The red hotspot precedes the solid mask. Fade it before the clear lenses.
  const glow=1-smooth((t-3.87)/.20);
  if(glow>0){
   ctx.save();ctx.globalCompositeOperation='screen';ctx.globalAlpha*=glow;
   const halo=ctx.createRadialGradient(947,495,0,947,495,158);
   halo.addColorStop(0,'rgba(236,8,67,.53)');halo.addColorStop(.28,'rgba(174,2,49,.45)');
   halo.addColorStop(.73,'rgba(129,0,40,.22)');halo.addColorStop(1,'rgba(109,0,41,0)');
   ctx.fillStyle=halo;ctx.fillRect(789,337,316,316);ctx.restore();
   ctx.save();ctx.globalAlpha*=glow*.40;ctx.filter='blur('+((1-smooth((t-3.62)/.44))*13*s+2)+'px)';
   ctx.drawImage(this.pinkEyes,...box);ctx.restore();
  }
  ctx.save();ctx.globalAlpha*=smooth((t-3.95)/.15);ctx.drawImage(this.pinkEyes,...box);ctx.restore();
  ctx.save();ctx.globalAlpha*=smooth((t-4.1)/.25);ctx.drawImage(this.assets.eyes,...box);ctx.restore();
  ctx.save();ctx.globalAlpha*=smooth((t-4.3)/.6);ctx.drawImage(this.assets.rings,...this.assets.ringMeta.box);ctx.restore();
  const label=smooth((t-TITLE_FADE_START)/(TITLE_VISIBLE-TITLE_FADE_START));if(label>0){ctx.globalAlpha*=label;ctx.drawImage(this.assets.title,...meta.titleBox);ctx.drawImage(this.assets.workspace,...meta.workspaceBox)}
  ctx.restore();
 }
 drawRed(t,boot){
  const video=this.assets.red;if(video.readyState<2)return;const ctx=this.ctx,s=sceneScale(this.width,boot.screenWidthRatio),box=this.assets.redMeta.box;
  // This reference matte already contains the original contraction and travel.
  // Place it once at its recorded mask anchor; a second scale/translation changes the effect.
  const x=boot.mask[0]*this.width-947*s,y=boot.mask[1]*this.height-518*s;
  ctx.save();ctx.translate(x,y);ctx.drawImage(this.redRenderer.render(video,1,this.assets.redColor),box[0]*s,box[1]*s,box[2]*s,box[3]*s);ctx.restore();
 }
 drawBoot(t,boot,clickFade=1){
  if(t<.7)this.drawShot(boot.origin,boot.target,boot.screenWidthRatio);
  if(t>=(19/60)&&t<(187/60)){
   // The reference leaves the outer white strands visible as the red silk contracts.
   const opacity=this.assets.redColor?1-smooth((t-139/60)/(48/60)):1;
   // Lift the fine white fibres after impact. Ease back before the existing
   // red contraction; ordinary desktop clicks keep their current strength.
   const reflection=.18+.37*smooth((t-.52)/.36)*(1-smooth((t-2.25)/.62));
   this.drawWeb(this.assets.web,...boot.target,boot.screenWidthRatio,opacity,reflection);
   if(this.assets.foreground)this.drawWeb(this.assets.foreground,...boot.target,boot.screenWidthRatio,1,0,this.assets.meta.foregroundSilkBox);
  }
  if(t>=(139/60)&&t<3.55)this.drawRed(t,boot);
  const fade=Math.min(clickFade,1-smooth((t-EXIT_FADE_START)/(BOOT_END-EXIT_FADE_START)));
  this.drawMask(t,boot.mask,fade,boot.screenWidthRatio);
 }
 frame(now){
  this.raf=0;const started=performance.now(),ctx=this.ctx;ctx.clearRect(0,0,this.width,this.height);this.silkCtx.clearRect(0,0,this.width,this.height);
  this.effects=this.effects.filter(item=>now-item.born<2800);for(const item of this.effects)this.drawWeb(item.video,item.u,item.v,item.screenWidthRatio);
  if(this.boot){
   const boot=this.boot,real=(now-boot.born)/1000;let t=real-boot.held;
   if(t>=(19/60)&&!boot.webStarted){
    boot.webStarted=true;
    const layers=this.assets.foreground?[this.assets.web,this.assets.foreground]:[this.assets.web];
    Promise.all(layers.map(value=>this.play(value))).catch(error=>this.notify({kind:'error',message:error.message}));
   }
   if(t>=(139/60)&&!boot.redStarted){boot.redStarted=true;if(this.assets.redColor)this.play(this.assets.redColor).catch(error=>this.notify({kind:'error',message:error.message}));this.play(this.assets.red).catch(error=>this.notify({kind:'error',message:error.message}))}
   if(t>=7.5&&!boot.clientReady){if(boot.holdStarted===null){boot.holdStarted=now;this.notify({kind:'bootWaiting',id:boot.id})}t=7.5}
   else if(boot.holdStarted!==null){boot.held+=(now-boot.holdStarted)/1000;boot.holdStarted=null;t=real-boot.held}
   if(t>=TITLE_VISIBLE&&!boot.titleShown){boot.titleShown=true;this.notifyTitle()}
   let clickFade=1;
   if(boot.enterRequested&&boot.clientReady){if(!boot.enterStarted)boot.enterStarted=now;clickFade=1-clamp((now-boot.enterStarted)/300);}
   this.drawBoot(t,boot,clickFade);if(!boot.firstDraw){boot.firstDraw=true;this.notify({kind:'bootStarted',id:boot.id})}if(boot.holdStarted===null)boot.frames++;boot.drawMs+=performance.now()-started;
   if(t>=BOOT_END||clickFade===0){ctx.clearRect(0,0,this.width,this.height);this.silkCtx.clearRect(0,0,this.width,this.height);this.boot=null;this.notify({kind:'bootFinished',id:boot.id,media:this.mediaSince(boot.mediaBaseline),entryMode:boot.enterRequested?'clicked-title':'automatic',frames:boot.frames,seconds:real,holdSeconds:boot.held,fps:boot.frames/Math.max(.001,real-boot.held),averageDrawMs:boot.drawMs/boot.frames,revision:RENDERER_REVISION,renderer:'GPU canvas, recorded red-phase alpha and reference textures'});}
  }
  if(this.effects.length||this.boot&&(this.boot.holdStarted===null||this.boot.clientReady))this.request();
 }
 async seek(t,screenWidthRatio=1){
  // Seek inside the wanted 60 Hz frame, so a floating-point boundary
  // cannot return the previous frame of the recovered foreground strand.
  const foregroundTime=t-(19/60)+1/120;
  this.abort();for(const [video,requested]of [[this.assets.web,t-(19/60)],[this.assets.shot,t],[this.assets.red,t-(139/60)],...(this.assets.redColor?[[this.assets.redColor,t-(139/60)]]:[]),...(this.assets.foreground?[[this.assets.foreground,foregroundTime]]:[])]){const time=Math.max(0,Math.min(video.duration-.0001,requested));
   await new Promise(resolve=>{if(Math.abs(video.currentTime-time)<.001){resolve();return}video.addEventListener('seeked',resolve,{once:true});video.currentTime=time});
  }
  const ratio=normalizedScreenWidth(screenWidthRatio);this.ctx.clearRect(0,0,this.width,this.height);this.silkCtx.clearRect(0,0,this.width,this.height);this.drawBoot(t,{screenWidthRatio:ratio,origin:[453/1920*ratio,480/1080],target:[946/1920*ratio,432/1080],mask:[947/1920*ratio,518/1080]});
 }
}

