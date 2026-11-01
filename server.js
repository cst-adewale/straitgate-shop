const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, 'public');
const adminFile = path.join(__dirname, 'private', 'straitgate-admin.html');
const authBase = (process.env.NEON_AUTH_BASE_URL || 'https://ep-old-sea-zaqa3i6p.neonauth.c-2.eu-west-2.aws.neon.tech/neondb/auth').replace(/\/$/, '');
if (!authBase || !(/^https:\/\//.test(authBase) || (process.env.NODE_ENV === 'test' && /^http:\/\/127\.0\.0\.1:\d+\/auth$/.test(authBase)))) {
  console.error('Set NEON_AUTH_BASE_URL to the production Neon Auth URL.');
  process.exit(1);
}
const failed = new Map();
const types = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.txt':'text/plain; charset=utf-8','.xml':'application/xml; charset=utf-8'};
const port = Number(process.env.PORT) || 3000;
function send(res, status, body, headers = {}) {
  res.writeHead(status, {'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers});
  res.end(body);
}
function json(res, status, body, headers = {}) {
  send(res, status, JSON.stringify(body), {'Content-Type':'application/json',...headers});
}
function serveFile(res, file) {
  fs.readFile(file, (err, body) => {
    if (err) return send(res, err.code === 'ENOENT' ? 404 : 500, 'Page unavailable');
    send(res, 200, body, {'Content-Type':types[path.extname(file)] || 'application/octet-stream'});
  });
}
function authCookies(header) {
  return (header || '').split(';').map(x => x.trim()).filter(x => /^(?:__Secure-|__Host-)?better-auth\./.test(x)).join('; ');
}
function responseCookies(response) {
  return (response.headers.getSetCookie?.() || []).map(raw => {
    const nameValue = raw.split(';')[0];
    return `${nameValue}; Path=/; HttpOnly; SameSite=Lax${process.env.RENDER ? '; Secure' : ''}`;
  });
}
async function neon(endpoint, options = {}) {
  return fetch(authBase + endpoint, {redirect:'manual',signal:AbortSignal.timeout(10000),...options});
}
async function adminSession(header) {
  const cookie = authCookies(header);
  if (!cookie) return false;
  const response = await neon('/get-session', {headers:{Cookie:cookie}});
  if (!response.ok) return false;
  const data = await response.json();
  return data?.user?.role === 'admin' && !data.user.banned;
}
async function readBody(req) {
  let body = '';
  for await (const chunk of req) {
    body += chunk;
    if (body.length > 4096) throw new Error('Request too large');
  }
  return body;
}
http.createServer(async (req, res) => {
  let pathname;
  try { pathname = new URL(req.url, 'http://localhost').pathname; }
  catch { return send(res, 400, 'Bad request'); }
  if (req.method === 'POST' && pathname === '/api/admin/login') {
    const ip = req.socket.remoteAddress || 'unknown';
    const attempt = failed.get(ip) || {count:0,until:0};
    if (attempt.until > Date.now()) return json(res, 429, {error:'Too many attempts. Try again later.'});
    let input;
    try { input = JSON.parse(await readBody(req)); }
    catch { return json(res, 400, {error:'Invalid request.'}); }
    if (typeof input.email !== 'string' || typeof input.password !== 'string') return json(res, 400, {error:'Email and password required.'});
    try {
      const upstream = await neon('/sign-in/email', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:input.email.trim(),password:input.password})});
      if (!upstream.ok) {
        attempt.count++;
        attempt.until = attempt.count >= 5 ? Date.now() + 15 * 60 * 1000 : 0;
        failed.set(ip, attempt);
        return json(res, 401, {error:'Incorrect email or password.'});
      }
      const cookies = responseCookies(upstream);
      const cookieHeader = cookies.map(x => x.split(';')[0]).join('; ');
      if (!await adminSession(cookieHeader)) return json(res, 403, {error:'This account is not a Straitgate admin.'});
      failed.delete(ip);
      return json(res, 200, {ok:true}, {'Set-Cookie':cookies});
    } catch (error) {
      console.error('Neon Auth login failed:', error.message);
      return json(res, 502, {error:'Sign-in service unavailable.'});
    }
  }
  if (req.method === 'POST' && pathname === '/api/admin/logout') {
    const cookie = authCookies(req.headers.cookie);
    try { if (cookie) await neon('/sign-out', {method:'POST',headers:{Cookie:cookie,'Content-Type':'application/json'},body:'{}'}); }
    catch (error) { console.error('Neon Auth sign-out failed:', error.message); }
    const expired = cookie.split('; ').filter(Boolean).map(x => `${x.split('=')[0]}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${process.env.RENDER ? '; Secure' : ''}`);
    return json(res, 200, {ok:true}, {'Set-Cookie':expired});
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method not allowed');
  if (pathname === '/admin' || pathname === '/straitgate-admin.html') {
    try {
      if (!await adminSession(req.headers.cookie)) return send(res, 302, '', {Location:'/straitgate-admin-login.html'});
      return serveFile(res, adminFile);
    } catch (error) {
      console.error('Neon Auth session check failed:', error.message);
      return send(res, 503, 'Authentication service unavailable');
    }
  }
  if (pathname === '/') pathname = '/straitgate-home.html';
  try { pathname = decodeURIComponent(pathname); }
  catch { return send(res, 400, 'Bad request'); }
  const file = path.resolve(root, '.' + pathname);
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return send(res, 404, 'Not found');
  serveFile(res, file);
}).listen(port, () => console.log(`Straitgate listening on ${port}`));
