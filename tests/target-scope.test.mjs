import test from 'node:test';
import assert from 'node:assert/strict';
import {inClientDocument,isClientPage} from '../runtime/target-scope.mjs';
test('main app survives login and route query/hash changes',()=>{
  for(const url of ['app://-/index.html','app://-/index.html#home','app://-/index.html?workspace=team#settings'])
    assert.equal(isClientPage({type:'page',url}),true,url);
});
test('embedded apps, login websites and overlays are excluded',()=>{
  for(const target of [
    {type:'iframe',url:'app://-/index.html'},
    {type:'webview',url:'app://-/index.html'},
    {type:'page',url:'https://auth.openai.com/index.html'},
    {type:'page',url:'https://cdn.platform.openai.com/index.html'},
    {type:'page',url:'app://elsewhere/index.html'},
    {type:'page',url:'app://user@-/index.html'},
    {type:'page',url:'app://-:9999/index.html'},
    {type:'page',url:'app://-/detached-window.html'},
    {type:'page',url:'app://-/index.html?window=avatar-overlay'},
    {type:'page',url:'app://-/index.html#AVATAR-OVERLAY'},
    {type:'page',url:'invalid'},null]) assert.equal(isClientPage(target),false,JSON.stringify(target));
});

import vm from 'node:vm';
test('navigation and child frames are rechecked before theme code runs',()=>{
  const code=inClientDocument('/* source */\nwindow.touched=true;');
  for(const [url,child,expected] of [
    ['app://-/index.html#team',false,true], ['app://-/index.html',true,false],
    ['https://auth.openai.com/',false,false], ['about:blank',false,false],
    ['app://-/index.html?window=avatar-overlay',false,false]
  ]){
    const window={};window.top=child?{}:window;
    vm.runInNewContext(code,{window,URL,location:{href:url}});
    assert.equal(!!window.touched,expected);
  }
});
