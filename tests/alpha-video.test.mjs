import test from 'node:test';
import assert from 'node:assert/strict';
import {AlphaVideo} from '../assets/v6/alpha-video.js';
test('60fps media uploads every frame and reuses unchanged frames',()=>{
 const previous=globalThis.document;const uploads=new Map();let active=0,draws=0;
 const gl={TEXTURE0:0,TEXTURE1:1,createShader:()=>({}),getShaderParameter:()=>true,createProgram:()=>({}),getProgramParameter:()=>true,createBuffer:()=>({}),getAttribLocation:()=>0,createTexture:()=>({}),getUniformLocation:(_,name)=>name,activeTexture(unit){active=unit},texImage2D(...args){const value=args.at(-1);uploads.set(value,(uploads.get(value)||0)+1)},texSubImage2D(...args){const value=args.at(-1);uploads.set(value,(uploads.get(value)||0)+1)},drawArrays(){draws++}};
 for(const name of ['shaderSource','compileShader','attachShader','linkProgram','useProgram','bindBuffer','bufferData','enableVertexAttribArray','vertexAttribPointer','bindTexture','texParameteri','pixelStorei','uniform3fv','viewport','uniform1f','uniform1i'])gl[name]=()=>{};
 globalThis.document={createElement(){return {getContext:()=>gl,addEventListener(){}}}};
 try{
  const video={videoWidth:4,videoHeight:4,currentTime:0,readyState:2};const compositor=new AlphaVideo(video,[190,6,35],60);
  for(const time of [0,1/60,2/60]){video.currentTime=time;compositor.render(video)}
  assert.equal(uploads.get(video),3);const before=draws;compositor.render(video);assert.equal(uploads.get(video),3);assert.equal(draws,before);
  const color={videoWidth:2,videoHeight:2,currentTime:0,readyState:2};compositor.render(video,1,color);assert.equal(uploads.get(color),1);assert.ok(draws>before);
  color.currentTime=1/60;compositor.render(video,1,color);assert.equal(uploads.get(color),2);assert.equal(uploads.get(video),3);assert.equal(active,gl.TEXTURE0);
 }finally{if(previous===undefined)delete globalThis.document;else globalThis.document=previous}
});
