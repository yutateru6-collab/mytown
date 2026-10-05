'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const guide = require('../civic-business.js');
const root = path.resolve(__dirname, '..');
const data = JSON.parse(fs.readFileSync(path.join(root, 'data/civic-business.json'), 'utf8'));
assert.equal(data.schemaVersion, 1);
assert.ok(data.items.length >= 3 && data.items.length <= 6);
assert.equal(new Set(data.items.map(i => i.id)).size, data.items.length);
for (const item of data.items) {
 for (const field of ['id','title','stage','targetDate','summary','businessImpact','amount','deadline','checkedAt']) assert.ok(typeof item[field] === 'string' && item[field].trim(), `${item.id}: missing ${field}`);
 assert.ok(['議論','提案','議決','実施','報告','要確認'].includes(item.stage));
 assert.equal(item.checkedAt, '2026年10月6日（日本時間）');
 assert.ok(item.sources.length && item.officialFacts.length && item.issues.length);
 for (const source of item.sources) assert.ok(new URL(source.url).hostname === 'www.city.nogata.fukuoka.jp', `unverified host: ${source.url}`);
 for (const id of item.relatedIds || []) assert.ok(data.items.some(i => i.id === id));
 const html = guide.card(item, data.items);
 for (const label of ['AIによる非公式要約','公式資料で確認した事実','推論','最終確認','期限・受付','一次資料']) assert.ok(html.includes(label));
 assert.ok(html.includes(item.checkedAt));
}
for (const route of Object.keys(guide.ROUTES)) assert.ok(guide.selectItems(data.items, route).length, `${route}: empty launch data`);
assert.equal(guide.selectItems(data.items, 'business', '存在しない案件').length, 0);
assert.equal(guide.selectItems(data.items, 'projects', '', '存在しない状態').length, 0);
assert.equal(guide.safeUrl('javascript:alert(1)'), '');
assert.equal(guide.safeUrl('http://example.org'), '');
assert.equal(guide.escape('<script>'), '&lt;script&gt;');
assert.ok(!guide.card({...data.items[0], title:'<script>', sources:[{title:'bad',url:'javascript:alert(1)'}]},data.items).includes('javascript:'));
assert.ok(guide.entries().includes('公式サービスではありません'));
const source = fs.readFileSync(path.join(root, 'civic-business.js'), 'utf8');
assert.match(source, /この条件に合う案件はありません/);
assert.match(source, /案件データを読み込めませんでした/);
assert.match(source, /data-cb-retry/);
for (const file of ['index.html','sw.js','scripts/build-static.mjs']) assert.ok(fs.readFileSync(path.join(root,file),'utf8').includes('civic-business.js'));
assert.ok(fs.readFileSync(path.join(root,'sw.js'),'utf8').includes('./data/civic-business.json'));
console.log('Civic/business source metadata, filtering, empty/error, escaping and build wiring passed');
// Execute the real browser branch with isolated app globals, without a browser package.
const vm = require('node:vm');
const handlers = {};
const rootElement = { innerHTML:'', querySelector(){return null;} };
let fallbackRenders = 0;
const runtime = {
 console, URL, location:{hash:'#business'}, state:{tab:'today',view:'tab'},
 main:rootElement, render(){fallbackRenders++;}, v2ApplyHashRoute(){this.state.tab='today';},
 v2SyncNav(){}, v2CloseSheet(){}, v2SetRoute({tab,page,hash}){runtime.state.tab=tab;runtime.state.v2Page=page;runtime.state.view='tab';runtime.location.hash=hash;runtime.render();},
 document:{addEventListener(name,handler){handlers[name]=handler;},getElementById(){return null;}}, window:{scrollTo(){}},
 requestAnimationFrame(callback){callback();},
 async fetch(){return {ok:true,async json(){return data;}};}, FormData:class { constructor(form){this.form=form;} get(key){return this.form[key];} },
};
vm.createContext(runtime);vm.runInContext(source,runtime);
setImmediate(()=>{
 try {
  assert.equal(runtime.state.tab,'politics');
  assert.ok(rootElement.innerHTML.includes('商売のチャンス'));
  assert.ok(rootElement.innerHTML.includes('cb-card'));
  handlers.submit({target:{matches(){return true;},query:'存在しない案件',stage:''},preventDefault(){}});
  assert.ok(rootElement.innerHTML.includes('この条件に合う案件はありません'));
  const target={closest(selector){return selector==='[data-cb-clear]'?{}:null;}};
  handlers.click({target});
  assert.ok(rootElement.innerHTML.includes('cb-card'));
  runtime.location.hash='#politics';runtime.render();assert.ok(fallbackRenders>0);
  runtime.location.hash='#projects';runtime.v2ApplyHashRoute();runtime.render();assert.ok(rootElement.innerHTML.includes('地域事業を追う'));
  let opened=false,scrolled=false,focused=false;
  runtime.document.getElementById=()=>({querySelector(tag){return tag==='details'?{set open(value){opened=value;}}:{setAttribute(){},focus(){focused=true;}};},scrollIntoView(){scrolled=true;}});
  runtime.location.hash='#projects/'+data.items[0].id;runtime.v2ApplyHashRoute();runtime.render();
  assert.ok(opened && scrolled && focused, 'direct related route opens and reveals its target');
  const frames=[];runtime.requestAnimationFrame=(callback)=>frames.push(callback);
  runtime.location.hash='#projects/'+data.items[1].id;runtime.v2ApplyHashRoute();runtime.render();
  let liveScrolled=false;
  runtime.document.getElementById=()=>({querySelector(tag){return tag==='details'?{}:{setAttribute(){},focus(){}};},scrollIntoView(){liveScrolled=true;}});
  runtime.render();frames.forEach(callback=>callback());
  assert.ok(liveScrolled, 'scheduled deep-link reveal uses current DOM after async re-render');
  console.log('Civic/business runtime routing, filters, deep link and render-race checks passed');
 } catch(error){console.error(error);process.exitCode=1;}
});
