const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {randomBytes,createCipheriv}=require('node:crypto');
const {spawnSync}=require('node:child_process');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'straitgate-backup-test-'));
try{
  const key=randomBytes(32),nonce=randomBytes(12),plain=Buffer.from('PostgreSQL backup test data');
  const cipher=createCipheriv('aes-256-gcm',key,nonce);
  const encrypted=Buffer.concat([Buffer.from('SGDB1'),nonce,cipher.update(plain),cipher.final(),cipher.getAuthTag()]);
  const source=path.join(dir,'sample.sge'),target=path.join(dir,'sample.dump');
  fs.writeFileSync(source,encrypted);
  const result=spawnSync(process.execPath,['scripts/decrypt-backup.js',source,target],{cwd:path.join(__dirname,'..'),env:{...process.env,BACKUP_ENCRYPTION_KEY:key.toString('base64')},encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);
  assert.deepEqual(fs.readFileSync(target),plain);
  fs.writeFileSync(source,Buffer.concat([encrypted.subarray(0,-1),Buffer.from([encrypted.at(-1)^1])]));
  const failed=spawnSync(process.execPath,['scripts/decrypt-backup.js',source,path.join(dir,'bad.dump')],{cwd:path.join(__dirname,'..'),env:{...process.env,BACKUP_ENCRYPTION_KEY:key.toString('base64')},encoding:'utf8'});
  assert.notEqual(failed.status,0);
  assert.equal(fs.existsSync(path.join(dir,'bad.dump')),false);
  console.log('Backup decrypt and tamper detection pass');
}finally{for(const name of fs.readdirSync(dir))fs.unlinkSync(path.join(dir,name));fs.rmdirSync(dir);}
