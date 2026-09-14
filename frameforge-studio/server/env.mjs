import { existsSync } from 'node:fs';
if (existsSync('.env')) process.loadEnvFile('.env');
// In managed environments the administrator supplies the trusted proxy CA.
// Child Node processes read this at startup; keep TLS verification enabled.
if (!process.env.NODE_EXTRA_CA_CERTS && existsSync('/usr/local/share/ca-certificates/cacert.pem'))
  process.env.NODE_EXTRA_CA_CERTS = '/usr/local/share/ca-certificates/cacert.pem';
