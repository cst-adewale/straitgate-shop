const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const html = fs.readFileSync(require('node:path').join(__dirname,'../private/straitgate-admin.html'),'utf8');
const script = [...html.matchAll(/<script(?:[^>]*)>([\s\S]*?)<\/script>/g)].at(-1)[1];
const elements = new Map();
const get = id => {
  if (!elements.has(id)) elements.set(id,{innerHTML:'',textContent:'',value:'',onclick:null,setAttribute(){}});
  return elements.get(id);
};
let working = false;
const context = {document:{getElementById:get,addEventListener(){}},window:{addEventListener(){}},location:{hash:''},fetch:async()=>{if(!working)throw Error('Database unavailable');return {ok:true,json:async()=>({products:[],inv:[],quotes:[]})}},performance:{now:()=>0},setInterval(){},setTimeout(){},clearTimeout(){},console};
(async()=>{
  vm.runInNewContext(script,context);
  assert.match(get('tabs').innerHTML,/data-tab="products"/);
  assert.match(get('tabs').innerHTML,/data-tab="budget"/);
  assert.match(get('tabs').innerHTML,/data-tab="health"/);
  await new Promise(resolve=>setImmediate(resolve));
  assert.match(get('view').innerHTML,/Database data unavailable/);
  assert.doesNotMatch(get('view').innerHTML,/Total revenue/);
  context.want='health';context.show();
  assert.match(get('view').innerHTML,/Backend health/);
  context.want='budget';context.show();
  assert.match(get('view').innerHTML,/Database data unavailable/);
  working=true;
  assert.equal(await context.refresh(),true);
  assert.match(get('view').innerHTML,/Sales-based budget/);
  working=false;
  assert.equal(await context.refresh(),false);
  assert.match(get('view').innerHTML,/Showing previously loaded data/);
  console.log('Admin navigation and database-failure states pass');
})().catch(error=>{console.error(error);process.exitCode=1});
