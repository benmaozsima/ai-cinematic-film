import { createServer, request } from 'node:http';
import { randomBytes, timingSafeEqual } from 'node:crypto';

const password = process.env.FRAMEFORGE_BRIDGE_PASSWORD;
if (!password) throw new Error('FRAMEFORGE_BRIDGE_PASSWORD is required');
const username = process.env.FRAMEFORGE_BRIDGE_USER || 'Ben';
const sessions = new Map();
const attempts = new Map();
const equal = (a, b) => {
  const aa = Buffer.from(a), bb = Buffer.from(b);
  return aa.length === bb.length && timingSafeEqual(aa, bb);
};
const safeReturn = (value = '/') =>
  value.startsWith('/') && !value.startsWith('//') && value.length < 2000 ? value : '/';
const page = (returnTo = '/', error = '') => `<!doctype html><html lang="he" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Frameforge — כניסה לפורטל</title><style>body{background:#141711;color:#edf0e6;font:18px system-ui;display:grid;place-items:center;min-height:95vh;margin:0}form{width:min(360px,85vw);display:grid;gap:18px;padding:32px;border:1px solid #434b39;border-radius:14px}h1{margin:0}input,button{font:inherit;padding:12px;border-radius:6px;border:1px solid #707960}input{width:100%;box-sizing:border-box}button{background:#c5e18a;cursor:pointer}p{color:#b8c2ac}</style><form method="post" action="/bridge-login?next=${encodeURIComponent(safeReturn(returnTo))}"><h1>FRAMEFORGE</h1><p>${error || 'כניסה לפורטל יצירת הסרטים'}</p><label>שם משתמש<input name="username" autocomplete="username" required dir="ltr"></label><label>סיסמה<input name="password" type="password" autocomplete="current-password" required dir="ltr"></label><button>כניסה</button></form></html>`;
const server = createServer(async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  const origin = `https://${req.headers.host}`;
  if (req.headers.origin && req.headers.origin !== origin) {
    res.writeHead(403); return res.end('Origin not allowed');
  }
  const requestUrl = new URL(req.url, 'http://bridge.local');
  const returnTo = safeReturn(requestUrl.searchParams.get('next') || '/');
  if (req.method === 'POST' && requestUrl.pathname === '/bridge-login') {
    const ip = req.headers['cf-connecting-ip'] || req.socket.remoteAddress;
    const count = attempts.get(ip) || { n: 0, until: Date.now() + 60000 };
    if (count.until < Date.now()) { count.n = 0; count.until = Date.now() + 60000; }
    if (++count.n > 10) { res.writeHead(429); return res.end('Try again in one minute'); }
    attempts.set(ip, count);
    let body = '';
    for await (const chunk of req) {
      body += chunk;
      if (body.length > 4096) { res.writeHead(413); return res.end(); }
    }
    const values = new URLSearchParams(body);
    if (!equal(values.get('username') || '', username) || !equal(values.get('password') || '', password)) {
      res.writeHead(401, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(page(returnTo, 'שם המשתמש או הסיסמה שגויים. נסו שוב.'));
    }
    const token = randomBytes(32).toString('hex');
    sessions.set(token, Date.now() + 86400000);
    res.writeHead(303, { Location: returnTo, 'Set-Cookie': `frameforge_session=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=86400` });
    return res.end();
  }
  const token = req.headers.cookie?.match(/(?:^|;\s*)frameforge_session=([a-f0-9]{64})(?:;|$)/)?.[1];
  if (!token || (sessions.get(token) || 0) < Date.now()) {
    if (/^\/api\/exports\/[a-f0-9-]{36}\/film\.mp4$/.test(requestUrl.pathname)) {
      res.writeHead(303, { Location: `/?next=${encodeURIComponent(req.url)}` }); return res.end();
    }
    if (req.url.startsWith('/api/')) { res.writeHead(401, { 'Content-Type': 'application/json' }); return res.end('{"error":"Please sign in again"}'); }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); return res.end(page(req.url));
  }
  if (!['GET', 'HEAD'].includes(req.method) && req.headers.origin !== origin) {
    res.writeHead(403); return res.end('Origin required');
  }
  const apiRequest = req.url.startsWith('/api/');
  const upstreamPort = apiRequest ? 3211 : 3210;
  const headers = { ...req.headers, host: `localhost:${upstreamPort}` };
  delete headers.cookie;
  delete headers.authorization;
  delete headers['x-forwarded-host'];
  if (headers.origin) headers.origin = 'http://localhost:3210';
  const upstream = request({ hostname: '127.0.0.1', port: upstreamPort, path: req.url, method: req.method, headers }, (response) => {
    const responseHeaders = { ...response.headers, 'Cache-Control': 'no-store' };
    if (/^\/api\/exports\/[a-f0-9-]{36}\/film\.mp4$/.test(requestUrl.pathname))
      responseHeaders['content-disposition'] = 'inline; filename="film.mp4"';
    res.writeHead(response.statusCode, responseHeaders);
    response.pipe(res);
  });
  upstream.on('error', () => { if (!res.headersSent) res.writeHead(502); res.end('The studio is restarting. Please retry shortly.'); });
  req.pipe(upstream);
  res.on('close', () => upstream.destroy());
});
setInterval(() => {
  for (const [key, expiry] of sessions) if (expiry < Date.now()) sessions.delete(key);
  for (const [key, value] of attempts) if (value.until < Date.now()) attempts.delete(key);
}, 60000).unref();
server.listen(3212, '127.0.0.1', () => console.log('Authenticated Frameforge bridge: http://127.0.0.1:3212'));
