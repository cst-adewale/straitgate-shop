const fs=require('node:fs');
const {pipeline}=require('node:stream/promises');
const {createDecipheriv}=require('node:crypto');

async function main(){
  const [source,target]=process.argv.slice(2);
  const key=Buffer.from(process.env.BACKUP_ENCRYPTION_KEY || '','base64');
  if (!source || !target || key.length!==32) throw Error('Usage: set BACKUP_ENCRYPTION_KEY, then node scripts/decrypt-backup.js <encrypted-file> <new-dump-file>');
  if (fs.existsSync(target)) throw Error('Refusing to overwrite an existing file.');
  const size=(await fs.promises.stat(source)).size;
  if (size<34) throw Error('Backup is too small.');
  const handle=await fs.promises.open(source,'r');
  const header=Buffer.alloc(17),tag=Buffer.alloc(16);
  try { await handle.read(header,0,17,0);await handle.read(tag,0,16,size-16); }
  finally { await handle.close(); }
  if (header.subarray(0,5).toString()!=='SGDB1') throw Error('Unknown backup format.');
  const decipher=createDecipheriv('aes-256-gcm',key,header.subarray(5,17));
  decipher.setAuthTag(tag);
  const partial=target+'.partial';
  if (fs.existsSync(partial)) throw Error('Refusing to overwrite an existing partial file.');
  try {
    await pipeline(fs.createReadStream(source,{start:17,end:size-17}),decipher,fs.createWriteStream(partial,{flags:'wx'}));
    await fs.promises.rename(partial,target);
    console.log('Backup decrypted and authenticated:',target);
  } catch (error) { await fs.promises.rm(partial,{force:true});throw error; }
}
main().catch(error=>{console.error(error.message);process.exitCode=1});
