const {spawn} = require('node:child_process');
const {randomBytes,createCipheriv} = require('node:crypto');
const {PassThrough} = require('node:stream');
const {S3Client} = require('@aws-sdk/client-s3');
const {Upload} = require('@aws-sdk/lib-storage');

const required=['DATABASE_URL_UNPOOLED','R2_BACKUP_ACCOUNT_ID','R2_BACKUP_BUCKET','R2_BACKUP_ACCESS_KEY_ID','R2_BACKUP_SECRET_ACCESS_KEY','BACKUP_ENCRYPTION_KEY'];
const missing=required.filter(name=>!process.env[name]);
if (missing.length) { console.error('Missing backup settings:',missing.join(', '));process.exit(1); }
const key=Buffer.from(process.env.BACKUP_ENCRYPTION_KEY,'base64');
if (key.length!==32) { console.error('BACKUP_ENCRYPTION_KEY must be a base64-encoded 32-byte key.');process.exit(1); }

const account=process.env.R2_BACKUP_ACCOUNT_ID;
const endpoint=process.env.R2_BACKUP_ENDPOINT || `https://${account}.r2.cloudflarestorage.com`;
const client=new S3Client({region:'auto',endpoint,credentials:{accessKeyId:process.env.R2_BACKUP_ACCESS_KEY_ID,secretAccessKey:process.env.R2_BACKUP_SECRET_ACCESS_KEY}});
const objectKey=`postgres/${new Date().toISOString().replace(/[:.]/g,'-')}.dump.sge`;
const nonce=randomBytes(12);
const cipher=createCipheriv('aes-256-gcm',key,nonce);
const encrypted=new PassThrough();
encrypted.write(Buffer.concat([Buffer.from('SGDB1'),nonce]));
const dump=spawn('docker',['run','--rm','-i','-e','DATABASE_URL','postgres:18','sh','-c','pg_dump -Fc --no-owner --no-acl "$DATABASE_URL"'],{env:process.env,stdio:['ignore','pipe','pipe']});
let dumpError='',exitCode=null,cipherEnded=false;
dump.stderr.on('data',chunk=>{dumpError+=(chunk.toString().slice(0,500));});
function finish(){if(exitCode===null || !cipherEnded)return;if(exitCode!==0)return encrypted.destroy(new Error('pg_dump failed: '+dumpError.slice(0,500)));encrypted.end(cipher.getAuthTag());}
dump.on('error',error=>encrypted.destroy(error));
dump.on('close',code=>{exitCode=code;finish();});
dump.stdout.pipe(cipher).pipe(encrypted,{end:false});
cipher.on('end',()=>{cipherEnded=true;finish();});

(async()=>{
  const upload=new Upload({client,params:{Bucket:process.env.R2_BACKUP_BUCKET,Key:objectKey,Body:encrypted,ContentType:'application/octet-stream'},queueSize:2,partSize:5*1024*1024,leavePartsOnError:false});
  await upload.done();
  console.log('Encrypted database backup uploaded:',objectKey);
})().catch(error=>{console.error('Backup failed:',error.message);dump.kill();process.exitCode=1});
