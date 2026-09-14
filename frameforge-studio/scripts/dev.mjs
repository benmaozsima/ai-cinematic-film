import '../server/env.mjs';
import { spawn } from 'node:child_process';
const children = [
  spawn(process.execPath, ['server/index.mjs'], {
    stdio: 'inherit',
    env: process.env,
  }),
  spawn(
    process.execPath,
    [
      'node_modules/vinext/dist/cli.js',
      'dev',
      '--port',
      process.env.UI_PORT || '3210',
    ],
    { stdio: 'inherit', env: process.env },
  ),
];
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const p of children) p.kill('SIGTERM');
  setTimeout(() => process.exit(code), 400);
}
for (const p of children) p.on('exit', (code) => stop(code || 0));
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
