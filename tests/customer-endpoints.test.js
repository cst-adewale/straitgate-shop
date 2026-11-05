const assert=require('node:assert/strict');
const http=require('node:http');
const {spawn}=require('node:child_process');
const {setTimeout:delay}=require('node:timers/promises');
const base='http://127.0.0.1:4391',authBase='http://127.0.0.1:4392/auth';
const user={id:'00000000-0000-4000-8000-000000000001',email:'shopper@example.test',name:'shopper',role:'user'};
const auth=http.createServer(async(req,res)=>{
  const path=new URL(req.url,'http://localhost').pathname;
  if(path==='/auth/sign-up/email'){res.writeHead(200,{'Content-Type':'application/json','Set-Cookie':'__Secure-neon-auth.session_token=shopper; Path=/; HttpOnly'});return res.end(JSON.stringify({user}));}
  if(path==='/auth/sign-in/email'){res.writeHead(200,{'Content-Type':'application/json','Set-Cookie':'__Secure-neon-auth.session_token=shopper; Path=/; HttpOnly'});return res.end(JSON.stringify({user}));}
  if(path==='/auth/get-session'){res.writeHead(200,{'Content-Type':'application/json'});return res.end(req.headers.cookie?.includes('session_token=shopper')?JSON.stringify({user}):'null');}
  if(path==='/auth/sign-out'){res.writeHead(200);return res.end('{}');}
  res.writeHead(404);res.end('{}');
});
let child;
const request=(path,options={})=>fetch(base+path,{redirect:'manual',...options});
(async()=>{try{
  await new Promise(resolve=>auth.listen(4392,'127.0.0.1',resolve));
  child=spawn(process.execPath,['-r','./tests/mock-customer-pg.js','server.js'],{cwd:require('node:path').join(__dirname,'..'),env:{...process.env,NODE_ENV:'test',PORT:'4391',DATABASE_URL:'postgresql://test:test@localhost/test',NEON_AUTH_BASE_URL:authBase,PUBLIC_ORIGIN:base},stdio:'ignore'});
  let ready=false;for(let i=0;i<40;i++){try{await request('/');ready=true;break}catch{await delay(100)}}assert.ok(ready,'server did not start');
  const payload={email:'shopper@example.test',username:'shopper',phone:'+2348000000000',password:'strong-password-123'};
  const headers={Origin:base,'Content-Type':'application/json'};
  let response=await request('/api/account/register',{method:'POST',headers,body:JSON.stringify(payload)});
  assert.equal(response.status,201);const signup=await response.json();assert.equal(signup.signedIn,true);
  const cookie=response.headers.get('set-cookie').split(';')[0];
  response=await request('/api/account/me',{headers:{Cookie:cookie}});assert.equal(response.status,200);assert.deepEqual((await response.json()).profile,{username:'shopper',phone:'+2348000000000'});
  response=await request('/api/account/register',{method:'POST',headers,body:JSON.stringify({...payload,email:'other@example.test'})});assert.equal(response.status,409);
  response=await request('/api/account/login',{method:'POST',headers,body:JSON.stringify({email:payload.email,password:payload.password})});assert.equal(response.status,200);
  assert.equal((await request('/api/account/profile',{method:'POST',headers:{...headers,Cookie:cookie},body:JSON.stringify({username:'other',phone:'+2348000000001'})})).status,409);
  assert.equal((await request('/api/account/logout',{method:'POST',headers:{...headers,Cookie:cookie},body:'{}'})).status,200);
  console.log('Customer registration, session, uniqueness, sign-in and sign-out pass');
}finally{if(child)child.kill();await new Promise(resolve=>auth.close(resolve));}})().catch(error=>{console.error(error);process.exitCode=1});
