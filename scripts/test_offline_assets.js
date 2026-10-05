#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const handlers={};
const helper={ok:true,text:'event helper precached'};
let cacheOptions;
const context={URL,console,self:{location:{href:'https://example.org/mytown/sw.js',origin:'https://example.org'},addEventListener(name,fn){handlers[name]=fn}},caches:{async match(request,options){cacheOptions=options;return options?.ignoreSearch&&new URL(request.url).pathname.endsWith('/event-schedule.js')?helper:undefined}},async fetch(){throw new Error('offline')}};
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.resolve(__dirname,'../sw.js'),'utf8'),context);
(async()=>{
 let result;
 handlers.fetch({request:{url:'https://example.org/mytown/event-schedule.js?v=1',method:'GET',mode:'cors'},respondWith(promise){result=promise}});
 assert.equal(await result,helper,'first offline reload reads versioned helper from precache');
 assert.equal(cacheOptions.ignoreSearch,true);
 console.log('Versioned offline static asset check passed');
})().catch((error)=>{console.error(error);process.exitCode=1});
