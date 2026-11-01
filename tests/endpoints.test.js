const assert = require('node:assert/strict');
const {spawn} = require('node:child_process');
const {setTimeout: delay} = require('node:timers/promises');

const port = 4319;
const base = `http://127.0.0.1:${port}`;
const child = spawn(process.execPath, ['server.js'], {
  cwd: require('node:path').join(__dirname, '..'),
  env: {...process.env, PORT:String(port), ADMIN_EMAIL:'admin@example.test', ADMIN_PASSWORD:'local-test-password', SESSION_SECRET:'local-test-session-secret-1234567890'},
  stdio:'ignore'
});

async function request(url, options = {}) {
  return fetch(base + url, {redirect:'manual', ...options});
}

(async () => {
  try {
    let ready = false;
    for (let i = 0; i < 40; i++) {
      try { await request('/'); ready = true; break; } catch { await delay(100); }
    }
    assert.ok(ready, 'server did not start');
    const pages = ['/', '/straitgate-home.html', '/straitgate-catalog.html', '/straitgate-product.html', '/straitgate-admin-login.html', '/straitgate-auth-modal.js', '/straitgate-theme.css', '/straitgate-theme.js', '/robots.txt', '/sitemap.xml'];
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
    const bad = await request('/api/admin/login', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({email:'admin@example.test', password:'wrong'})});
    assert.equal(bad.status, 401);
    console.log('401 wrong password');
    const good = await request('/api/admin/login', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({email:'admin@example.test', password:'local-test-password'})});
    assert.equal(good.status, 200);
    const cookie = good.headers.get('set-cookie').split(';')[0];
    assert.ok(cookie.startsWith('straitgate_session='));
    console.log('200 correct password + session cookie');
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
    child.kill();
  }
})().catch(err => { console.error(err); process.exitCode = 1; });
