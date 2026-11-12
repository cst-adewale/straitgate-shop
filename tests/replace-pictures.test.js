const assert=require('node:assert/strict');
const pgPath=require.resolve('pg');
const r2Path=require.resolve('../r2-storage');
const uploaded=[],removed=[],queries=[];
require.cache[pgPath]={id:pgPath,filename:pgPath,loaded:true,exports:{Pool:class {
  async query(sql,values){
    queries.push({sql,values});
    if (sql.startsWith('SELECT image_key,image_keys FROM public.products')) return {rows:[{image_key:'products/old.jpg',image_keys:['products/old.jpg']}]};
    if (sql.startsWith('SELECT image_keys FROM public.inventory_items')) return {rows:[{image_keys:['inventory/old.jpg']}]};
    if (sql.startsWith('UPDATE public.products SET name=') || sql.startsWith('UPDATE public.inventory_items SET name=')) return {rows:[{id:1}]};
    return {rows:[]};
  }
}}};
require.cache[r2Path]={id:r2Path,filename:r2Path,loaded:true,exports:{
  uploadJpeg:async (buffer,folder)=>{assert.ok(Buffer.isBuffer(buffer));const key=`${folder}/new-${uploaded.length}.jpg`;uploaded.push(key);return key;},
  remove:async key=>removed.push(key)
}};
process.env.DATABASE_URL='postgresql://test:test@localhost/test';
const data=require('../admin-data');
const jpg='data:image/jpeg;base64,/9j/2Q==';
(async()=>{
  await data.mutate('products','edit',{id:1,name:'Gate',cat:'Garden gate',price:250,stockQuantity:2,images:[jpg,jpg]});
  assert.deepEqual(queries[1].values.slice(-2),[uploaded.slice(0,2),uploaded[0]]);
  await data.mutate('inventory','edit',{id:2,name:'Drill',type:'Tool',qty:1,min:0,cost:100,images:[jpg]});
  assert.deepEqual(queries[3].values.at(-1),[uploaded[2]]);
  assert.deepEqual(removed,['products/old.jpg','inventory/old.jpg']);
  await assert.rejects(()=>data.mutate('products','edit',{id:1,name:'Gate',price:-1,stockQuantity:2}),TypeError);
  console.log('Product and inventory detail editing with picture replacement passes');
})().catch(error=>{console.error(error);process.exitCode=1});
