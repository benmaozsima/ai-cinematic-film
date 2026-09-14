import '../server/env.mjs';
import { DatabaseSync } from 'node:sqlite';
import {
  mkdirSync,
  copyFileSync,
  cpSync,
  existsSync,
  writeFileSync,
} from 'node:fs';
import { resolve } from 'node:path';
import { db, DATA, uid } from '../server/store.mjs';
const dest = resolve(
  'backups',
  `${new Date().toISOString().replace(/[:.]/g, '-')}-${uid().slice(0, 8)}`,
);
mkdirSync(resolve(dest, 'media'), { recursive: true });
db.prepare('VACUUM INTO ?').run(resolve(dest, 'production.sqlite'));
const snapshot = new DatabaseSync(resolve(dest, 'production.sqlite'), {
  readOnly: true,
});
let count = 0;
for (const row of snapshot.prepare('SELECT data FROM films').all())
  for (const v of JSON.parse(row.data).versions) {
    if (v.localPath) {
      copyFileSync(
        resolve(DATA, 'media', v.localPath),
        resolve(dest, 'media', v.localPath),
      );
      count++;
    }
  }
for (const row of snapshot.prepare('SELECT data FROM exports').all()) {
  const e = JSON.parse(row.data);
  if (e.status === 'complete' && existsSync(resolve(DATA, 'exports', e.id)))
    cpSync(resolve(DATA, 'exports', e.id), resolve(dest, 'exports', e.id), {
      recursive: true,
    });
}
snapshot.close();
db.close();
writeFileSync(
  resolve(dest, 'RESTORE.txt'),
  'Stop Frameforge. Copy this folder to the studio-data location (keep the old folder as a backup). Restart Frameforge. Credentials are not included.\n',
);
console.log(
  `Backup complete: ${dest}\n${count} original assets copied. API keys are excluded.`,
);
