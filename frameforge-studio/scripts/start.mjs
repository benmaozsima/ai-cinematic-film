import '../server/env.mjs';
import { spawn, execFileSync } from 'node:child_process';
import { request } from 'node:http';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { startProdServer } from 'vinext/server/prod-server';
if (!existsSync('dist/server/index.js')) {
  console.error('Run npm run build first.');
  process.exit(1);
}
const uiPort = Number(process.env.UI_PORT || 3210),
  apiPort = Number(process.env.API_PORT || 3211);
function macosCertificateBundle() {
  if (process.platform !== 'darwin') return null;
  const destination = resolve('studio-data', 'macos-certificates.pem');
  const keychains = [
    '/Library/Keychains/System.keychain',
    resolve(homedir(), 'Library/Keychains/login.keychain-db'),
  ];
  try {
    const certificates = keychains.flatMap((keychain) => {
      if (!existsSync(keychain)) return [];
      return [
        execFileSync('/usr/bin/security', [
          'find-certificate',
          '-a',
          '-p',
          keychain,
        ]),
      ];
    });
    // Fal's current endpoint chain is rooted at Google Trust Services. Node's
    // bundled CA store may omit that chain on some local macOS installations,
    // even though the system trust store accepts it. Fetch the public root
    // bundle through macOS-verified curl, then pass it only to the child API.
    const googleRoots = execFileSync('/usr/bin/curl', [
      '--fail',
      '--silent',
      '--show-error',
      '--location',
      '--max-time',
      '10',
      'https://pki.goog/roots.pem',
    ]);
    if (!certificates.length && !googleRoots.length) return null;
    mkdirSync(resolve('studio-data'), { recursive: true });
    writeFileSync(destination, Buffer.concat([...certificates, googleRoots]), {
      mode: 0o600,
    });
    return destination;
  } catch (error) {
    console.warn(`Could not load macOS certificates for providers: ${error.message}`);
    return null;
  }
}
const extraCa = process.env.NODE_EXTRA_CA_CERTS || macosCertificateBundle();
const backend = spawn(process.execPath, ['server/index.mjs'], {
  stdio: 'inherit',
  env: { ...process.env, ...(extraCa ? { NODE_EXTRA_CA_CERTS: extraCa } : {}) },
});
const { server } = await startProdServer({ port: uiPort, host: '127.0.0.1' });
const handlers = server.listeners('request');
server.removeAllListeners('request');
const localUiHosts = new Set([`localhost:${uiPort}`, `127.0.0.1:${uiPort}`]);
const trustedUiHosts = new Set(
  String(process.env.FRAMEFORGE_TRUSTED_HOSTS || '')
    .split(',')
    .map((host) => host.trim())
    .filter(Boolean),
);
server.on('request', (req, res) => {
  const allowedHosts =
    process.env.FRAMEFORGE_DEPLOYMENT_MODE === 'remote'
      ? new Set([...localUiHosts, ...trustedUiHosts])
      : localUiHosts;
  if (!allowedHosts.has(req.headers.host)) {
    res.writeHead(403);
    return res.end('Host not allowed.');
  }
  if (req.url.startsWith('/api/')) {
    const proxied = request(
      {
        hostname: '127.0.0.1',
        port: apiPort,
        path: req.url,
        method: req.method,
        headers: { ...req.headers, host: `127.0.0.1:${apiPort}` },
      },
      (upstream) => {
        res.writeHead(upstream.statusCode, upstream.headers);
        upstream.pipe(res);
      },
    );
    proxied.on('error', () => {
      if (!res.headersSent)
        res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          error: 'Production server is starting. Retry shortly.',
        }),
      );
    });
    req.pipe(proxied);
  } else for (const handler of handlers) handler.call(server, req, res);
});
console.log(`Frameforge Studio: http://localhost:${uiPort}`);
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  backend.kill('SIGTERM');
  server.close(() => process.exit(code));
  setTimeout(() => process.exit(code), 1000).unref();
}
backend.on('exit', (code) => stop(code || 0));
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
