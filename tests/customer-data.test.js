const assert=require('node:assert/strict');
const path=require.resolve('pg');
const calls=[];
require.cache[path]={id:path,filename:path,loaded:true,exports:{Pool:class {async query(sql,values){calls.push({sql,values});if(sql.startsWith('SELECT username'))return {rows:[{username:'shopper',phone:'+2348000000000'}]};return {rows:[]}}}}};
process.env.DATABASE_URL='postgresql://test:test@localhost/test';
const customer=require('../customer-data');
(async()=>{
  assert.equal(customer.configured,true);
  assert.equal(await customer.usernameAvailable('shopper'),true);
  await customer.createProfile('00000000-0000-4000-8000-000000000000','shopper','+2348000000000');
  assert.deepEqual(await customer.getProfile('00000000-0000-4000-8000-000000000000'),{username:'shopper',phone:'+2348000000000'});
  assert.equal(calls.length,3);
  assert.deepEqual(calls[1].values,['00000000-0000-4000-8000-000000000000','shopper','+2348000000000']);
  console.log('Customer profile queries pass');
})().catch(error=>{console.error(error);process.exitCode=1});
