const assert = require('node:assert/strict');
const pgPath = require.resolve('pg');
const statements = [];
require.cache[pgPath] = {id:pgPath,filename:pgPath,loaded:true,exports:{Pool:class {
  async query(sql, values) {
    statements.push({sql,values});
    return {rows:[]};
  }
}}};
process.env.DATABASE_URL = 'postgresql://test:test@localhost/test';
const data = require('../admin-data');

(async () => {
  assert.equal(data.configured, true);
  assert.deepEqual(await data.list(), {products:[],inv:[],quotes:[]});
  assert.deepEqual(await data.publishedProducts(), []);
  await data.mutate('products','add',{name:'Gate',cat:'Garden gate',color:'Blue',price:100,desc:'Made to measure'});
  await data.mutate('inventory','add',{name:'Steel',type:'Material',sku:'ST-1',qty:5,unit:'pcs',min:2,loc:'Store',cost:10});
  await data.mutate('quotes','add',{cust:'Customer',items:[{d:'Gate',q:1,p:100}],inst:5,disc:0});
  await data.mutate('inventory','adjust',{id:1,delta:-1});
  await data.mutate('quotes','status',{id:1,status:'Sent'});
  await data.mutate('products','remove',{id:1});
  assert.equal(statements.length, 10);
  assert.match(statements[3].sql, /WHERE published=true/);
  assert.match(statements[4].sql, /INSERT INTO public\.products/);
  assert.match(statements[5].sql, /INSERT INTO public\.inventory_items/);
  assert.match(statements[6].sql, /INSERT INTO public\.quotes/);
  assert.match(statements[7].sql, /UPDATE public\.inventory_items/);
  assert.match(statements[8].sql, /UPDATE public\.quotes/);
  assert.match(statements[9].sql, /DELETE FROM public\.products/);
  await assert.rejects(() => data.mutate('products','add',{name:'Bad',price:1,img:'javascript:alert(1)'}), TypeError);
  await assert.rejects(() => data.mutate('inventory','adjust',{id:1,delta:100}), TypeError);
  console.log('Admin database actions and validation pass');
})().catch(error => {console.error(error);process.exitCode=1});
