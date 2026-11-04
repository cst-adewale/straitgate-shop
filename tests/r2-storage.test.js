const assert = require('node:assert/strict');
const sdkPath = require.resolve('@aws-sdk/client-s3');
const sent = [];
class Command { constructor(input) {this.input=input} }
require.cache[sdkPath] = {id:sdkPath,filename:sdkPath,loaded:true,exports:{
  S3Client:class {async send(command){sent.push(command);return command instanceof GetObjectCommand ? {Body:{transformToByteArray:async () => new Uint8Array([0xff,0xd8,0xff,0xd9])}} : {}}},
  PutObjectCommand:class extends Command {},
  GetObjectCommand:class GetObjectCommand extends Command {},
  DeleteObjectCommand:class extends Command {}
}};
const {GetObjectCommand} = require('@aws-sdk/client-s3');
Object.assign(process.env,{R2_ACCOUNT_ID:'test-account',R2_BUCKET:'test-bucket',R2_ACCESS_KEY_ID:'test-key',R2_SECRET_ACCESS_KEY:'test-secret'});
const r2 = require('../r2-storage');

(async () => {
  assert.equal(r2.configured,true);
  const key = await r2.uploadJpeg(Buffer.from([0xff,0xd8,0xff,0xd9]));
  assert.match(key,/^products\/[a-f0-9-]{36}\.jpg$/);
  assert.equal(sent[0].input.Bucket,'test-bucket');
  assert.equal(sent[0].input.ContentType,'image/jpeg');
  assert.deepEqual(await r2.getJpeg(key),Buffer.from([0xff,0xd8,0xff,0xd9]));
  await r2.remove(key);
  assert.equal(sent.length,3);
  await assert.rejects(() => r2.uploadJpeg(Buffer.from('not a jpeg')),TypeError);
  await assert.rejects(() => r2.getJpeg('../secret'),TypeError);
  console.log('R2 upload, read, delete, and validation pass');
})().catch(error => {console.error(error);process.exitCode=1});
