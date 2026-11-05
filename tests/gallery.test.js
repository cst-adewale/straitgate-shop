const assert = require('node:assert/strict');
const pgPath = require.resolve('pg');
const r2Path = require.resolve('../r2-storage');
const calls = [], removed = [];
let keys = [];
require.cache[pgPath] = {id:pgPath,filename:pgPath,loaded:true,exports:{Pool:class {
  async query(sql, values) {
    calls.push({sql,values});
    if (sql.startsWith('INSERT INTO public.products')) { keys=values[8]; return {rows:[]}; }
    if (sql.startsWith('UPDATE public.products SET stock_quantity')) return {rows:[{id:7}]};
    if (sql.startsWith('UPDATE public.products SET main_image_index')) return {rows:[{id:7}]};
    if (sql.startsWith('SELECT image_key,image_keys,main_image_index')) return {rows:[{image_key:keys[1],image_keys:keys,main_image_index:1}]};
    return {rows:[]};
  }
}}};
require.cache[r2Path] = {id:r2Path,filename:r2Path,loaded:true,exports:{
  uploadJpeg:async () => `products/${keys.length + calls.filter(c=>c.sql.startsWith('INSERT')).length}-${Math.random()}.jpg`,
  getJpeg:async key => Buffer.from(key),
  remove:async key => removed.push(key)
}};
process.env.DATABASE_URL='postgresql://test:test@localhost/test';
const data=require('../admin-data');
const jpg='data:image/jpeg;base64,/9j/2Q==';
(async()=>{
  await data.mutate('products','add',{name:'Gate',price:10,stockQuantity:2,images:[jpg,jpg],mainImageIndex:1});
  assert.equal(keys.length,2);
  assert.equal(calls[0].values[9],1);
  assert.equal(calls[0].values[10],2);
  await data.mutate('products','setStock',{id:7,stockQuantity:3});
  assert.deepEqual(calls[1].values,[7,3]);
  await data.mutate('products','mainImage',{id:7,index:0});
  assert.deepEqual(calls[2].values,[7,0]);
  assert.equal((await data.productImage(7)).toString(),keys[1]);
  assert.equal((await data.productImage(7,0)).toString(),keys[0]);
  assert.equal(await data.productImage(7,3),null);
  await assert.rejects(()=>data.mutate('products','add',{name:'Too many',price:1,images:Array(6).fill(jpg)}),TypeError);
  await assert.rejects(()=>data.mutate('products','mainImage',{id:7,index:5}),TypeError);
  await assert.rejects(()=>data.mutate('products','setStock',{id:7,stockQuantity:-1}),TypeError);
  await assert.rejects(()=>data.mutate('products','setStock',{id:7,stockQuantity:1.5}),TypeError);
  assert.equal(removed.length,0);
  console.log('Product gallery upload, main image, retrieval and limits pass');
})().catch(error=>{console.error(error);process.exitCode=1});
