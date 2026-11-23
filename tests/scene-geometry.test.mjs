import test from 'node:test';
import assert from 'node:assert/strict';
import {canvasResolution,sceneScale,normalizedScreenWidth} from '../assets/v6/scene-geometry.mjs';
import {ReferenceVisual} from '../assets/v6/visual.js';
const near=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-8,`${actual} != ${expected}`);
function fixture(){
 const calls=[];
 const ctx=Object.fromEntries(['save','restore','translate','scale','drawImage','transform','clearRect'].map(name=>[name,(...args)=>calls.push({name,args})]));
 ctx.createRadialGradient=(...args)=>{calls.push({name:'radialHalo',args});return {addColorStop(){}}};
 ctx.fillRect=(...args)=>calls.push({name:'fillRect',args});
 const visual=Object.create(ReferenceVisual.prototype);
 Object.assign(visual,{width:3840,height:1080,ctx,silkCtx:ctx,effects:[],request(){},notify(data){calls.push({name:'notify',data})},assets:{meta:{maskBox:[766.5,337.5,361,361],titleBox:[796,787,190,50],workspaceBox:[994,788,138,48]},rings:{},ringMeta:{box:[676,247,542,542]},eyes:{},title:{},workspace:{},red:{readyState:2},redMeta:{box:[348,10,1204,702]},shot:{readyState:2}},redRenderer:{render(){return {}}},baseDark:{},pinkEyes:{}});
 visual.boot={mask:[.75,.5],screenWidthRatio:.5,titleShown:true,born:0,held:0,holdStarted:null,webStarted:true,redStarted:true,clientReady:true,frames:0,drawMs:0};
 return {visual,calls};
}
test('single, side-by-side and vertical screen sizes retain physical scale',()=>{
 near(sceneScale(1920),1);near(sceneScale(3840,.5),1);near(sceneScale(7680,.5),2);near(sceneScale(1920,1),1);
 assert.equal(normalizedScreenWidth(-1),1);assert.equal(normalizedScreenWidth(NaN),1);
});
test('actual renderer mask, red mesh and web use the selected monitor width',()=>{
 const {visual,calls}=fixture();
 visual.drawMask(6.5,[.75,.5],1,.5);
 near(calls.find(c=>c.name==='scale').args[0],1);
 calls.length=0;visual.drawWeb({readyState:2},.75,.5,.5);
 const web=calls.find(c=>c.name==='drawImage');near(web.args[3],1920);near(web.args[4],1080);
 calls.length=0;visual.drawRed(3,visual.boot);
 const red=calls.find(c=>c.name==='drawImage');near(red.args[3],1204);near(red.args[4],702);
});
test('projectile transform stays undistorted on the second screen',()=>{
 const {visual,calls}=fixture();
 visual.drawShot([(1920+453)/3840,480/1080],[(1920+946)/3840,432/1080],.5);
 const [a,b,c,d,x,y]=calls.find(c=>c.name==='transform').args;
 near(a,1);near(b,0);near(c,0);near(d,1);near(x,1920);near(y,0);
});
test('the boot mask does not paint while the final silk contraction is still visible',()=>{
 const {visual,calls}=fixture();
 const matte={};
 visual.redRenderer={render:()=>matte};
 visual.drawBoot(3.54,visual.boot);
 assert.ok(calls.some(c=>c.name==='drawImage'&&c.args[0]===matte));
 assert.ok(!calls.some(c=>c.name==='drawImage'&&c.args[0]===visual.baseDark));
 calls.length=0;
 visual.drawBoot(3.61,visual.boot);
 assert.ok(!calls.some(c=>c.name==='drawImage'&&c.args[0]===matte));
 assert.ok(calls.some(c=>c.name==='drawImage'&&c.args[0]===visual.baseDark));
});
test('native click bounds cover the same padded label area as renderer hit testing',()=>{
 const {visual,calls}=fixture();visual.boot.titleShown=false;visual.drawBoot=()=>{};
 visual.frame(6500);
 const box=calls.find(c=>c.name==='notify'&&c.data.kind==='bootTitleVisible').data.box;
 near(box.width*3840,204);
 const centerX=box.u+box.width/2,centerY=box.v+box.height/2;
 assert.equal(visual.enter(centerX,centerY),true);
 assert.equal(visual.enter(box.u-.001,centerY),false);
 assert.equal(visual.enter(box.u+box.width+.001,centerY),false);
 assert.equal(visual.enter(NaN,centerY),false);
});

test('a title click before readiness queues the handoff through the waiting frame',()=>{
 const {visual,calls}=fixture();
 visual.boot.clientReady=false;
 visual.drawBoot=()=>{};
 visual.frame(6250);
 const box=visual.titleBounds();
 assert.equal(visual.enter(box.u+box.width/2,box.v+box.height/2),true);
 assert.equal(calls.find(entry=>entry.data?.kind==='bootEnterRequested').data.clientReady,false);
 visual.frame(7500);
 visual.frame(10000);
 assert.ok(visual.boot);
 assert.equal(calls.some(entry=>entry.data?.kind==='bootFinished'),false);
 visual.ready();
 visual.frame(10100);
 visual.frame(10450);
 const completion=calls.find(entry=>entry.data?.kind==='bootFinished')?.data;
 assert.equal(completion.entryMode,'clicked-title');
 assert.ok(completion.holdSeconds>=2.6);
});

test('the opening reaches the reference title and exit beats without an early automatic handoff',()=>{
 const {visual,calls}=fixture();
 visual.boot.titleShown=false;
 visual.frame(5770);
 assert.ok(!calls.some(c=>c.name==='drawImage'&&c.args[0]===visual.assets.title));
 visual.frame(6100);
 assert.ok(calls.some(c=>c.name==='drawImage'&&c.args[0]===visual.assets.title));
 assert.ok(calls.some(c=>c.data?.kind==='bootTitleVisible'));
 const fades=[];
 visual.drawMask=(_time,_anchor,fade)=>fades.push(fade);
 visual.frame(7950);
 assert.equal(fades.at(-1),1);
 assert.ok(visual.boot);
 visual.frame(8250);
 assert.equal(fades.at(-1),0);
 assert.equal(visual.boot,null);
 assert.equal(calls.find(c=>c.data?.kind==='bootFinished').data.entryMode,'automatic');
});


test('normal 100/125/150/200 percent scales retain unbounded single-HD pixels',()=>{
 for(const ratio of [1,1.25,1.5,2]){
  const size=canvasResolution(1920,1080,ratio);
  assert.equal(size.pixelWidth,1920*ratio);
  assert.equal(size.pixelHeight,1080*ratio);
 }
});

test('wide or vertical virtual desktops cap bitmap cost and preserve aspect ratio',()=>{
 for(const [width,height] of [[7680,4320],[16000,1920],[3840,8640]]){
  const size=canvasResolution(width,height,2);
  assert.ok(size.pixelWidth<=8192&&size.pixelHeight<=8192);
  assert.ok(size.pixelWidth*size.pixelHeight<=3840*2160);
  assert.ok(Math.abs(size.scaleX-size.scaleY)<=1/Math.min(width,height));
 }
});


test('the early mask glow ends before the high contrast white lenses',()=>{
 const {visual,calls}=fixture();
 for(const [t,expectGlow] of [[3.59,false],[3.8,true],[4.1,false],[6.5,false]]){
  calls.length=0;visual.drawMask(t,visual.boot.mask,1,visual.boot.screenWidthRatio);
  assert.equal(calls.some(x=>x.name==='radialHalo'),expectGlow);
  if(expectGlow)assert.ok(calls.some(x=>x.name==='fillRect'));
 }
});
