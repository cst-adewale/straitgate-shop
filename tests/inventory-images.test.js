const assert=require('node:assert/strict');
const pgPath=require.resolve('pg');
const r2Path=require.resolve('../r2-storage');
const uploads=[],removed=[];
let keys=[];
require.cache[pgPath]={id:pgPath,filename:pgPath,loaded:true,exports:{Pool:class {
  async query(sql,values){
    if (sql.startsWith('INSERT INTO public.inventory_items')) {keys=values[10];return {rows:[]};}
    if (sql.startsWith('SELECT image_keys FROM public.inventory_items')) return {rows:[{image_keys:keys}]};
    if (sql.startsWith('DELETE FROM public.inventory_items')) return {rows:[{image_keys:keys}]};
    return {rows:[]};
  }
}}};
require.cache[r2Path]={id:r2Path,filename:r2Path,loaded:true,exports:{
  uploadJpeg:async (buffer,folder)=>{assert.equal(folder,'inventory');assert.ok(Buffer.isBuffer(buffer));const key=`inventory/image-${uploads.length}.jpg`;uploads.push(key);return key;},
  getJpeg:async key=>Buffer.from(key),
  remove:async key=>removed.push(key)
}};
process.env.DATABASE_URL='postgresql://test:test@localhost/test';
const data=require('../admin-data');
const jpg='data:image/jpeg;base64,/9j/2Q==';
(async()=>{
  await data.mutate('inventory','add',{name:'Drill',type:'Tool',qty:1,min:0,cost:0,images:[jpg,jpg]});
  assert.equal(keys.length,2);
  assert.equal((await data.inventoryImage(1)).toString(),keys[0]);
  assert.equal((await data.inventoryImage(1,1)).toString(),keys[1]);
  assert.equal(await data.inventoryImage(1,3),null);
  await assert.rejects(()=>data.mutate('inventory','add',{name:'Bad',qty:1,min:0,cost:0,images:Array(6).fill(jpg)}),TypeError);
  await data.mutate('inventory','remove',{id:1});
  assert.deepEqual(removed,keys);
  console.log('Inventory picture upload, retrieval, limits and cleanup pass');
})().catch(error=>{console.error(error);process.exitCode=1});
