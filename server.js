const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const adminData = require('./admin-data');

const root = path.join(__dirname, 'public');
const adminFile = path.join(__dirname, 'private', 'straitgate-admin.html');
const authBase = (process.env.NEON_AUTH_BASE_URL || 'https://ep-old-sea-zaqa3i6p.neonauth.c-2.eu-west-2.aws.neon.tech/neondb/auth').replace(/\/$/, '');
const publicOrigin = (process.env.PUBLIC_ORIGIN || 'https://straitgate.onrender.com').replace(/\/$/, '');
if (!authBase || !(/^https:\/\//.test(authBase) || (process.env.NODE_ENV === 'test' && /^http:\/\/127\.0\.0\.1:\d+\/auth$/.test(authBase)))) {
  console.error('Set NEON_AUTH_BASE_URL to the production Neon Auth URL.');
  process.exit(1);
}
if (!/^https:\/\/[^/]+$/.test(publicOrigin) && !(process.env.NODE_ENV === 'test' && /^http:\/\/127\.0\.0\.1:\d+$/.test(publicOrigin))) {
  console.error('Set PUBLIC_ORIGIN to the deployed site origin.');
  process.exit(1);
}
const failed = new Map();
const resetAttempts = new Map();
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
  return (header || '').split(';').map(x => x.trim()).filter(x => /^(?:__Secure-|__Host-)?(?:neon-auth|neonauth|better-auth)\./.test(x)).join('; ');
}
function responseCookies(response) {
  return (response.headers.getSetCookie?.() || []).map(raw => {
    const nameValue = raw.split(';')[0];
    return `${nameValue}; Path=/; HttpOnly; SameSite=Lax${process.env.RENDER ? '; Secure' : ''}`;
  });
}
async function neon(endpoint, options = {}) {
  const headers = new Headers(options.headers || {});
  if (options.method && options.method !== 'GET' && options.method !== 'HEAD') headers.set('Origin', publicOrigin);
  return fetch(authBase + endpoint, {redirect:'manual',signal:AbortSignal.timeout(10000),...options,headers});
}
async function adminSession(header, diagnose = false) {
  const cookie = authCookies(header);
  if (!cookie) {
    if (diagnose) console.error('Neon admin check: no recognized session cookie');
    return false;
  }
  const response = await neon('/get-session', {headers:{Cookie:cookie}});
  if (!response.ok) {
    if (diagnose) console.error('Neon admin check: session endpoint status', response.status);
    return false;
  }
  const data = await response.json();
  if (diagnose && (data?.user?.role !== 'admin' || data.user.banned)) {
    console.error('Neon admin check: session user', {present:!!data?.user, role:data?.user?.role || 'none', banned:!!data?.user?.banned});
  }
  return data?.user?.role === 'admin' && !data.user.banned;
}
async function readBody(req, limit = 4096) {
  let body = '';
  for await (const chunk of req) {
    body += chunk;
    if (body.length > limit) throw new Error('Request too large');
  }
  return body;
}
async function handleAdminData(req, res, pathname) {
  try {
    if (!await adminSession(req.headers.cookie)) return json(res, 401, {error:'Sign in as an admin.'});
    if (!adminData.configured) return json(res, 503, {error:'DATABASE_URL is not configured on the server.'});
    if (req.method === 'GET' && pathname === '/api/admin/data') return json(res, 200, await adminData.list());
    if (req.method !== 'POST' || pathname !== '/api/admin/data') return json(res, 405, {error:'Method not allowed.'});
    if (req.headers.origin !== publicOrigin) return json(res, 403, {error:'Request origin not allowed.'});
    let input;
    try { input = JSON.parse(await readBody(req, 350000)); }
    catch { return json(res, 400, {error:'Invalid request.'}); }
    await adminData.mutate(input.kind, input.action, input.data || {});
    return json(res, 200, await adminData.list());
  } catch (error) {
    if (error instanceof TypeError) return json(res, 400, {error:error.message});
    console.error('Admin data operation failed:', error.code || error.message);
    return json(res, 503, {error:'Database operation failed.'});
  }
}
http.createServer(async (req, res) => {
  let pathname;
  try { pathname = new URL(req.url, 'http://localhost').pathname; }
  catch { return send(res, 400, 'Bad request'); }
  if (pathname === '/api/admin/data') return handleAdminData(req, res, pathname);
  if (pathname === '/api/products') {
    if (req.method !== 'GET') return json(res, 405, {error:'Method not allowed.'});
    if (!adminData.configured) return json(res, 503, {error:'Shop database is not configured.'});
    try { return json(res, 200, {products:await adminData.publishedProducts()}); }
    catch (error) { console.error('Shop products failed:', error.code || error.message); return json(res, 503, {error:'Products are temporarily unavailable.'}); }
  }
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
      if (!await adminSession(cookieHeader, true)) {
        console.error('Neon admin check: sign-in cookie names', cookies.map(x => x.split('=')[0]));
        return json(res, 403, {error:'Admin session could not be verified.'});
      }
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
  if (req.method === 'POST' && pathname === '/api/admin/forgot-password') {
    const ip = req.socket.remoteAddress || 'unknown';
    const history = (resetAttempts.get(ip) || []).filter(time => time > Date.now() - 15 * 60 * 1000);
    if (history.length >= 5) return json(res, 429, {error:'Too many reset requests. Try again later.'});
    let input;
    try { input = JSON.parse(await readBody(req)); }
    catch { return json(res, 400, {error:'Invalid request.'}); }
    if (typeof input.email !== 'string' || !/^\S+@\S+\.\S+$/.test(input.email) || input.email.length > 254) return json(res, 400, {error:'Enter a valid email address.'});
    history.push(Date.now());
    resetAttempts.set(ip, history);
    try {
      const upstream = await neon('/request-password-reset', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:input.email.trim(),redirectTo:publicOrigin + '/straitgate-reset-password.html'})});
      if (!upstream.ok && upstream.status !== 404) {
        console.error('Neon reset request failed:', upstream.status);
        return json(res, 502, {error:'Could not request a reset link. Try again later.'});
      }
      return json(res, 200, {ok:true,message:'If an account exists, a reset link has been sent.'});
    } catch (error) {
      console.error('Neon reset request failed:', error.message);
      return json(res, 502, {error:'Could not reach the reset service.'});
    }
  }
  if (req.method === 'POST' && pathname === '/api/admin/reset-password') {
    let input;
    try { input = JSON.parse(await readBody(req)); }
    catch { return json(res, 400, {error:'Invalid request.'}); }
    if (typeof input.token !== 'string' || !input.token || input.token.length > 2048 || typeof input.newPassword !== 'string' || input.newPassword.length < 12 || input.newPassword.length > 128) return json(res, 400, {error:'Use a valid reset link and a password of 12–128 characters.'});
    try {
      const upstream = await neon('/reset-password', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:input.token,newPassword:input.newPassword})});
      if (!upstream.ok) {
        const detail = await upstream.json().catch(() => ({}));
        const reason = String(detail.code || detail.message || '');
        console.error('Neon password reset rejected:', upstream.status, detail.code || 'no-code');
        if (/password/i.test(reason)) return json(res, 400, {error:'Neon rejected this password. Choose a longer, less predictable password.'});
        if (upstream.status === 429) return json(res, 429, {error:'Too many attempts. Try again later.'});
        if (upstream.status >= 500) return json(res, 502, {error:'Reset service unavailable. Try again later.'});
        return json(res, 400, {error:'The reset token was not accepted. Request a new link and open the newest email.'});
      }
      return json(res, 200, {ok:true});
    } catch (error) {
      console.error('Neon password reset failed:', error.message);
      return json(res, 502, {error:'Could not reach the reset service.'});
    }
  }
  if (req.method === 'GET' && /^\/api\/product-image\/\d+$/.test(pathname)) {
    if (!adminData.configured) return send(res, 503, 'Image service unavailable');
    try {
      const image = await adminData.productImage(pathname.split('/').pop());
      return image ? send(res, 200, image, {'Content-Type':'image/jpeg'}) : send(res, 404, 'Image not found');
    } catch (error) {
      console.error('Product image failed:', error.code || error.message);
      return send(res, 503, 'Image service unavailable');
    }
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
