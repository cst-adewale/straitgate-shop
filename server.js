const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const root = path.join(__dirname, 'public');
const adminFile = path.join(__dirname, 'private', 'straitgate-admin.html');
const email = process.env.ADMIN_EMAIL;
const password = process.env.ADMIN_PASSWORD;
const secret = process.env.SESSION_SECRET;
if (!email || !password || !secret || secret.length < 32) {
  console.error('Set ADMIN_EMAIL, ADMIN_PASSWORD and SESSION_SECRET (at least 32 characters).');
  process.exit(1);
}

const passwordHash = crypto.createHash('sha256').update(password).digest();
const failed = new Map();
const activeSessions = new Map();
const types = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.txt':'text/plain; charset=utf-8','.xml':'application/xml; charset=utf-8'};
const port = Number(process.env.PORT) || 3000;

function send(res, status, body, headers = {}) {
  res.writeHead(status, {'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff', ...headers});
  res.end(body);
}
function sign(value) { return crypto.createHmac('sha256', secret).update(value).digest('base64url'); }
function session(req) {
  const token = /(?:^|;\s*)straitgate_session=([^;]+)/.exec(req.headers.cookie || '')?.[1];
  if (!token) return false;
  const [expires, mac] = token.split('.');
  if (!/^\d+$/.test(expires) || !mac || Number(expires) < Date.now()) return false;
  const expected = Buffer.from(sign(expires));
  const actual = Buffer.from(mac);
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected) && activeSessions.get(token) === Number(expires);
}
function secureCookie(req) { return req.headers['x-forwarded-proto'] === 'https' ? '; Secure' : ''; }
function serveFile(res, file) {
  fs.readFile(file, (err, body) => {
    if (err) return send(res, err.code === 'ENOENT' ? 404 : 500, 'Page unavailable');
    send(res, 200, body, {'Content-Type':types[path.extname(file)] || 'application/octet-stream'});
  });
}

http.createServer((req, res) => {
  let pathname;
  try { pathname = new URL(req.url, 'http://localhost').pathname; }
  catch { return send(res, 400, 'Bad request'); }

  if (req.method === 'POST' && pathname === '/api/admin/login') {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 4096) req.destroy();
    });
    req.on('end', () => {
      const ip = req.socket.remoteAddress || 'unknown';
      const attempt = failed.get(ip) || {count:0, until:0};
      if (attempt.until > Date.now()) return send(res, 429, JSON.stringify({error:'Too many attempts. Try again later.'}), {'Content-Type':'application/json'});
      let input;
      try { input = JSON.parse(body); } catch { return send(res, 400, 'Invalid request'); }
      const supplied = crypto.createHash('sha256').update(String(input.password || '')).digest();
      const valid = String(input.email || '').trim().toLowerCase() === email.toLowerCase() && crypto.timingSafeEqual(supplied, passwordHash);
      if (!valid) {
        attempt.count++;
        attempt.until = attempt.count >= 5 ? Date.now() + 15 * 60 * 1000 : 0;
        failed.set(ip, attempt);
        return send(res, 401, JSON.stringify({error:'Incorrect email or password.'}), {'Content-Type':'application/json'});
      }
      failed.delete(ip);
      const expires = String(Date.now() + 8 * 60 * 60 * 1000);
      const token = `${expires}.${sign(expires)}`;
      activeSessions.set(token, Number(expires));
      send(res, 200, JSON.stringify({ok:true}), {'Content-Type':'application/json', 'Set-Cookie':`straitgate_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=28800${secureCookie(req)}`});
    });
    return;
  }
  if (req.method === 'POST' && pathname === '/api/admin/logout') {
    const token = /(?:^|;\s*)straitgate_session=([^;]+)/.exec(req.headers.cookie || '')?.[1];
    if (token) activeSessions.delete(token);
    return send(res, 200, JSON.stringify({ok:true}), {'Content-Type':'application/json', 'Set-Cookie':`straitgate_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secureCookie(req)}`});
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method not allowed');
  if (pathname === '/admin' || pathname === '/straitgate-admin.html') {
    if (!session(req)) return send(res, 302, '', {Location:'/straitgate-admin-login.html'});
    return serveFile(res, adminFile);
  }
  if (pathname === '/') pathname = '/straitgate-home.html';
  try { pathname = decodeURIComponent(pathname); }
  catch { return send(res, 400, 'Bad request'); }
  const file = path.resolve(root, '.' + pathname);
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return send(res, 404, 'Not found');
  serveFile(res, file);
}).listen(port, () => console.log(`Straitgate listening on ${port}`));
