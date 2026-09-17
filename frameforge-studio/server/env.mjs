import { existsSync } from 'node:fs';
if (existsSync('.env')) process.loadEnvFile('.env');
// In managed environments the administrator supplies the trusted proxy CA.
// Child Node processes read this at startup; keep TLS verification enabled.
if (!process.env.NODE_EXTRA_CA_CERTS && existsSync('/usr/local/share/ca-certificates/cacert.pem'))
  process.env.NODE_EXTRA_CA_CERTS = '/usr/local/share/ca-certificates/cacert.pem';
// Local macOS and Linux launches may run the API directly (rather than via
// scripts/start.mjs). Prefer the platform bundle in that case so provider
// requests keep TLS verification enabled instead of failing at generation time.
if (!process.env.NODE_EXTRA_CA_CERTS && existsSync('/etc/ssl/cert.pem'))
  process.env.NODE_EXTRA_CA_CERTS = '/etc/ssl/cert.pem';
