import { existsSync, readFileSync, writeFileSync, chmodSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { DATA, fail, now } from './store.mjs';

const exec = promisify(execFile);
const SERVICE = 'Frameforge Studio';
const CONFIG_PATH = resolve(DATA, 'credential-bindings.json');
const injected = new Set();

export const deploymentMode =
  process.env.FRAMEFORGE_DEPLOYMENT_MODE === 'remote' ? 'remote' : 'local';

function validName(value) {
  if (typeof value !== 'string' || !/^[A-Z][A-Z0-9_]{1,63}$/.test(value))
    fail('Credential variable names must use A–Z, 0–9, and underscores.');
  return value;
}

function readConfig() {
  if (!existsSync(CONFIG_PATH)) return { version: 1, bindings: [] };
  try {
    const parsed = JSON.parse(readFileSync(CONFIG_PATH, 'utf8'));
    return {
      version: 1,
      bindings: Array.isArray(parsed.bindings) ? parsed.bindings : [],
    };
  } catch {
    fail(
      'Credential binding metadata could not be read. Restore it from a backup.',
    );
  }
}

function writeConfig(config) {
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2) + '\n', {
    mode: 0o600,
  });
  chmodSync(CONFIG_PATH, 0o600);
}

function configuredNames(config) {
  const fromConfig = config.bindings.map((item) => item.envName);
  const fromEnvironment = String(process.env.FRAMEFORGE_CREDENTIALS || '')
    .split(',')
    .map((value) => value.trim())
    .filter((value) => /^[A-Z][A-Z0-9_]{1,63}$/.test(value));
  return [...new Set(['FAL_KEY', ...fromConfig, ...fromEnvironment])];
}

async function keychainRead(envName) {
  if (process.platform !== 'darwin') return null;
  try {
    const { stdout } = await exec('/usr/bin/security', [
      'find-generic-password',
      '-s',
      SERVICE,
      '-a',
      envName,
      '-w',
    ]);
    return stdout.replace(/\r?\n$/, '') || null;
  } catch {
    return null;
  }
}

export async function hydrateSecrets() {
  if (deploymentMode === 'remote') return;
  const config = readConfig();
  for (const envName of configuredNames(config)) {
    if (process.env[envName]) continue;
    const secret = await keychainRead(envName);
    if (secret) {
      process.env[envName] = secret;
      injected.add(envName);
    }
  }
}

export function secret(envName) {
  return process.env[validName(envName)] || null;
}

export async function credentials() {
  const config = readConfig();
  const labels = new Map(
    config.bindings.map((item) => [item.envName, item.label]),
  );
  const result = [];
  for (const envName of configuredNames(config)) {
    const fromEnvironment = Boolean(process.env[envName]);
    const fromKeychain =
      !fromEnvironment && deploymentMode === 'local'
        ? Boolean(await keychainRead(envName))
        : false;
    result.push({
      envName,
      label: labels.get(envName) || (envName === 'FAL_KEY' ? 'FAL' : envName),
      configured: fromEnvironment || fromKeychain,
      source: fromEnvironment
        ? deploymentMode === 'remote'
          ? 'remote-environment'
          : injected.has(envName)
            ? 'macos-keychain'
            : 'environment'
        : fromKeychain
          ? 'macos-keychain'
          : 'not-configured',
      editable: deploymentMode === 'local',
    });
  }
  return result;
}

export async function saveCredential(input) {
  if (deploymentMode === 'remote')
    fail(
      'Remote credentials are managed by the server environment. Add this variable in your host’s secret settings, then restart the service.',
      409,
    );
  if (process.platform !== 'darwin')
    fail(
      'Local credential storage currently requires macOS Keychain. For another platform, provide the key as an environment variable.',
      501,
    );
  const envName = validName(input.envName);
  const label = String(input.label || envName)
    .trim()
    .slice(0, 120);
  if (!label) fail('Credential name is required.');
  if (
    typeof input.secret !== 'string' ||
    !input.secret ||
    input.secret.length > 10000 ||
    /[\r\n]/.test(input.secret)
  )
    fail('Enter a valid secret without line breaks.');
  await exec('/usr/bin/security', [
    'add-generic-password',
    '-U',
    '-s',
    SERVICE,
    '-a',
    envName,
    '-w',
    input.secret,
  ]);
  const config = readConfig();
  const existing = config.bindings.find((item) => item.envName === envName);
  if (existing) {
    existing.label = label;
    existing.updatedAt = now();
  } else {
    config.bindings.push({
      envName,
      label,
      createdAt: now(),
      updatedAt: now(),
    });
  }
  writeConfig(config);
  process.env[envName] = input.secret;
  injected.add(envName);
  return {
    envName,
    label,
    configured: true,
    source: 'macos-keychain',
    editable: true,
  };
}

export async function removeCredential(envName) {
  if (deploymentMode === 'remote')
    fail('Remote credentials are managed by the server environment.', 409);
  if (process.platform !== 'darwin')
    fail('Local credential storage currently requires macOS Keychain.', 501);
  envName = validName(envName);
  try {
    await exec('/usr/bin/security', [
      'delete-generic-password',
      '-s',
      SERVICE,
      '-a',
      envName,
    ]);
  } catch {}
  const config = readConfig();
  config.bindings = config.bindings.filter((item) => item.envName !== envName);
  writeConfig(config);
  if (injected.has(envName)) {
    delete process.env[envName];
    injected.delete(envName);
  }
  return { ok: true };
}
