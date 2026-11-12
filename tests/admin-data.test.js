const assert = require('node:assert/strict');
const pgPath = require.resolve('pg');
const statements = [];
require.cache[pgPath] = {id:pgPath,filename:pgPath,loaded:true,exports:{Pool:class {
  async query(sql, values) {
    statements.push({sql,values});
    if (/count\(DISTINCT visitor_hash\)|count\(\*\) FILTER/.test(sql)) return {rows:[{day:'0',week:'0',month:'0'}]};
    if (/coalesce\(sum\(amount_ngn\)/.test(sql)) return {rows:[{day:'0',week:'0',month:'0'}]};
    if (/SELECT item_type FROM public.inventory_items/.test(sql)) return {rows:[{item_type:'Tool'}]};
    if (/SELECT id FROM public.products WHERE id/.test(sql)) return {rows:[{id:1}]};
    if (/UPDATE public.inventory_usage/.test(sql)) return {rows:[{id:1}]};
    return {rows:[]};
  }
}}};
process.env.DATABASE_URL = 'postgresql://test:test@localhost/test';
const data = require('../admin-data');

(async () => {
  assert.equal(data.configured, true);
  assert.deepEqual(await data.list(), {products:[],inv:[],quotes:[],usage:[],traffic:{day:0,week:0,month:0},signups:{day:0,week:0,month:0},topProduct:null,letterhead:'',revenue:{day:0,week:0,month:0}});
  assert.deepEqual(await data.publishedProducts(), []);
  await data.mutate('products','add',{name:'Gate',cat:'Garden gate',color:'Blue',price:100,stockQuantity:4,desc:'Made to measure'});
  await data.mutate('inventory','add',{name:'Steel',type:'Material',sku:'ST-1',qty:5,unit:'pcs',min:2,loc:'Store',cost:10});
  await data.mutate('quotes','add',{cust:'Customer',items:[{d:'Gate',q:1,p:100}],inst:5,disc:0});
  await data.mutate('inventory','adjust',{id:1,delta:-1});
  await data.mutate('quotes','status',{id:1,status:'Sent'});
  await data.mutate('products','remove',{id:1});
  assert.equal(statements.length, 16);
  assert.match(statements[9].sql, /WHERE published=true/);
  assert.match(statements[10].sql, /INSERT INTO public\.products/);
  assert.equal(statements[10].values[10],4);
  assert.match(statements[11].sql, /INSERT INTO public\.inventory_items/);
  assert.match(statements[12].sql, /INSERT INTO public\.quotes/);
  assert.match(statements[13].sql, /UPDATE public\.inventory_items/);
  assert.match(statements[14].sql, /UPDATE public\.quotes/);
  assert.match(statements[15].sql, /DELETE FROM public\.products/);
  await data.mutate('inventory','checkout',{id:1,usedBy:'Ada'});
  assert.match(statements[17].sql,/INSERT INTO public\.inventory_usage/);
  await data.mutate('inventory','return',{id:1});
  assert.match(statements[18].sql,/UPDATE public\.inventory_usage/);
  await data.mutate('settings','letterhead',{image:'data:image/png;base64,iVBORw0KGgo='});
  assert.match(statements[19].sql,/INSERT INTO public\.admin_settings/);
  await data.mutate('payments','confirm',{productId:1,amount:500,reference:'verified-1'});
  assert.match(statements[21].sql,/INSERT INTO public\.confirmed_payments/);
  await assert.rejects(()=>data.mutate('inventory','checkout',{id:1,usedBy:''}),TypeError);
  await assert.rejects(()=>data.mutate('inventory','add',{name:'Invalid type',type:'Other',qty:1,min:0,cost:0}),TypeError);
  await assert.rejects(() => data.mutate('products','add',{name:'Bad',price:1,img:'javascript:alert(1)'}), TypeError);
  await assert.rejects(() => data.mutate('inventory','adjust',{id:1,delta:100}), TypeError);
  console.log('Admin database actions and validation pass');
})().catch(error => {console.error(error);process.exitCode=1});
