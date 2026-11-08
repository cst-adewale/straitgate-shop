const {randomUUID} = require('node:crypto');
const {S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand} = require('@aws-sdk/client-s3');

const account = process.env.R2_ACCOUNT_ID;
const bucket = process.env.R2_BUCKET;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
const configured = !!(account && bucket && accessKeyId && secretAccessKey);
const client = configured ? new S3Client({
  region:'auto',
  endpoint:process.env.R2_ENDPOINT || `https://${account}.r2.cloudflarestorage.com`,
  credentials:{accessKeyId,secretAccessKey}
}) : null;

async function uploadJpeg(buffer) {
  if (!configured) throw new Error('Cloudflare R2 is not configured.');
  if (!Buffer.isBuffer(buffer) || buffer.length < 4 || buffer.length > 225000 || buffer[0] !== 0xff || buffer[1] !== 0xd8 || buffer.at(-2) !== 0xff || buffer.at(-1) !== 0xd9) throw new TypeError('Use a valid JPEG image under 225 KB.');
  const key = `products/${randomUUID()}.jpg`;
  await client.send(new PutObjectCommand({Bucket:bucket,Key:key,Body:buffer,ContentType:'image/jpeg'}));
  return key;
}

async function uploadPng(buffer) {
  if (!configured) throw new Error('Cloudflare R2 is not configured.');
  if (!Buffer.isBuffer(buffer) || buffer.length < 8 || buffer.length > 5000000 || !buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) throw new TypeError('Use a valid PNG image under 5 MB.');
  const key=`products/${randomUUID()}.png`;
  await client.send(new PutObjectCommand({Bucket:bucket,Key:key,Body:buffer,ContentType:'image/png'}));
  return key;
}

async function getJpeg(key) {
  if (!configured) throw new Error('Cloudflare R2 is not configured.');
  if (!/^products\/[a-f0-9-]{36}\.(jpg|png)$/.test(key)) throw new TypeError('Invalid image key.');
  const object = await client.send(new GetObjectCommand({Bucket:bucket,Key:key}));
  return Buffer.from(await object.Body.transformToByteArray());
}

async function remove(key) {
  if (configured && key) await client.send(new DeleteObjectCommand({Bucket:bucket,Key:key}));
}

module.exports = {configured,uploadJpeg,uploadPng,getJpeg,remove};
