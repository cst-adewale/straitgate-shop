const assert = require('node:assert/strict');
const http = require('node:http');
const {spawn} = require('node:child_process');
const {setTimeout: delay} = require('node:timers/promises');

const port = 4319;
const base = `http://127.0.0.1:${port}`;
const sessions = new Set();
let resetRequest;
let resetSubmission;
const authOrigins = {};
const auth = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (req.method === 'POST') authOrigins[url.pathname] = req.headers.origin;
  if (url.pathname === '/auth/request-password-reset') {
    let body = '';
    for await (const chunk of req) body += chunk;
    resetRequest = JSON.parse(body);
    res.writeHead(200, {'Content-Type':'application/json'});
    return res.end('{"status":true}');
  }
  if (url.pathname === '/auth/reset-password') {
    let body = '';
    for await (const chunk of req) body += chunk;
    resetSubmission = JSON.parse(body);
    res.writeHead(resetSubmission.token === 'valid-token' ? 200 : 400, {'Content-Type':'application/json'});
    return res.end('{}');
  }
  if (url.pathname === '/auth/sign-in/email') {
    let body = '';
    for await (const chunk of req) body += chunk;
    const input = JSON.parse(body);
    if (input.password !== 'local-test-password') { res.writeHead(401); return res.end('{}'); }
    const token = input.email === 'viewer@example.test' ? 'viewer' : 'admin';
    sessions.add(token);
    res.writeHead(200, {'Content-Type':'application/json','Set-Cookie':`__Secure-neon-auth.session_token=${token}; Path=/; HttpOnly`});
    return res.end('{}');
  }
  const token = /__Secure-neon-auth\.session_token=(admin|viewer)/.exec(req.headers.cookie || '')?.[1];
  if (url.pathname === '/auth/get-session') {
    res.writeHead(200, {'Content-Type':'application/json'});
    return res.end(token && sessions.has(token) ? JSON.stringify({user:{role:token}}) : 'null');
  }
  if (url.pathname === '/auth/sign-out') {
    if (token) sessions.delete(token);
    res.writeHead(200); return res.end('{}');
  }
  res.writeHead(404); res.end();
});
let child;

async function request(url, options = {}) {
  return fetch(base + url, {redirect:'manual', ...options});
}

(async () => {
  try {
    await new Promise(resolve => auth.listen(4320, '127.0.0.1', resolve));
    child = spawn(process.execPath, ['server.js'], {
      cwd: require('node:path').join(__dirname, '..'),
      env: {...process.env, NODE_ENV:'test', PORT:String(port), DATABASE_URL:'', NEON_AUTH_BASE_URL:'http://127.0.0.1:4320/auth', PUBLIC_ORIGIN:base},
      stdio:'ignore'
    });
    let ready = false;
    for (let i = 0; i < 40; i++) {
      try { await request('/'); ready = true; break; } catch { await delay(100); }
    }
    assert.ok(ready, 'server did not start');
    const pages = ['/', '/straitgate-home.html', '/straitgate-catalog.html', '/straitgate-product.html', '/straitgate-account.html', '/straitgate-account.js', '/straitgate-catalog-data.js', '/straitgate-product-data.js', '/straitgate-admin-login.html', '/straitgate-reset-password.html', '/straitgate-auth-modal.js', '/straitgate-theme.css', '/straitgate-theme.js', '/robots.txt', '/sitemap.xml'];
    for (const page of pages) {
      const res = await request(page);
      assert.equal(res.status, 200, page);
      console.log(`200 ${page}`);
    }
    for (const page of ['/admin', '/straitgate-admin.html']) {
      const res = await request(page);
      assert.equal(res.status, 302, page);
      assert.equal(res.headers.get('location'), '/straitgate-admin-login.html');
      console.log(`302 ${page} without session`);
    }
    const deniedData = await request('/api/admin/data');
    assert.equal(deniedData.status, 401);
    assert.equal((await request('/api/account/me')).status,401);
    assert.equal((await request('/api/account/register',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({email:'shopper@example.test',username:'shopper',phone:'+2348000000000',password:'a-good-password-123'})})).status,503);
    assert.equal((await request('/api/account/login',{method:'POST',headers:{Origin:'https://wrong.example','Content-Type':'application/json'},body:'{}'})).status,403);
    assert.equal((await request('/api/admin/health')).status, 401);
    assert.equal((await request('/api/admin/ping?signal=123')).status, 401);
    const unavailableShop = await request('/api/products');
    assert.equal(unavailableShop.status, 503);
    const bad = await request('/api/admin/login', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({email:'admin@example.test', password:'wrong'})});
    assert.equal(bad.status, 401);
    console.log('401 wrong password');
    const good = await request('/api/admin/login', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({email:'admin@example.test', password:'local-test-password'})});
    assert.equal(good.status, 200);
    const cookie = good.headers.get('set-cookie').split(';')[0];
    assert.ok(cookie.startsWith('__Secure-neon-auth.session_token='));
    console.log('200 correct password + session cookie');
    const missingDatabase = await request('/api/admin/data', {headers:{Cookie:cookie}});
    assert.equal(missingDatabase.status, 503);
    const health = await request('/api/admin/health', {headers:{Cookie:cookie}});
    assert.equal(health.status, 503);
    assert.equal((await health.json()).database.ok, false);
    assert.equal((await request('/api/admin/ping?signal=123', {headers:{Cookie:cookie}})).status, 400);
    assert.equal((await request('/api/admin/ping?signal=aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee', {headers:{Cookie:cookie}})).status, 200);
    const viewer = await request('/api/admin/login', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({email:'viewer@example.test', password:'local-test-password'})});
    assert.equal(viewer.status, 403);
    console.log('403 non-admin account');
    const forgot = await request('/api/admin/forgot-password', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'admin@example.test'})});
    assert.equal(forgot.status, 200);
    assert.deepEqual(resetRequest, {email:'admin@example.test',redirectTo:base + '/straitgate-reset-password.html'});
    const reset = await request('/api/admin/reset-password', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:'valid-token',newPassword:'a-unique-password-123'})});
    assert.equal(reset.status, 200);
    assert.deepEqual(resetSubmission, {token:'valid-token',newPassword:'a-unique-password-123'});
    for (const endpoint of ['/auth/sign-in/email', '/auth/request-password-reset', '/auth/reset-password']) {
      assert.equal(authOrigins[endpoint], base, `${endpoint} origin`);
    }
    const invalidReset = await request('/api/admin/reset-password', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:'expired',newPassword:'a-unique-password-123'})});
    assert.equal(invalidReset.status, 400);
    console.log('200 reset request + submission; 400 invalid token');
    const admin = await request('/admin', {headers:{Cookie:cookie}});
    assert.equal(admin.status, 200);
    assert.match(await admin.text(), /Admin dashboard/);
    console.log('200 /admin with session');
    const logout = await request('/api/admin/logout', {method:'POST', headers:{Cookie:cookie}});
    assert.equal(logout.status, 200);
    assert.match(logout.headers.get('set-cookie'), /Max-Age=0/);
    console.log('200 logout clears cookie');
    const replay = await request('/admin', {headers:{Cookie:cookie}});
    assert.equal(replay.status, 302);
    console.log('302 old session rejected after logout');
    const missing = await request('/missing.html');
    assert.equal(missing.status, 404);
    console.log('404 missing page');
  } finally {
    child?.kill();
    auth.close();
  }
})().catch(err => { console.error(err); process.exitCode = 1; });
