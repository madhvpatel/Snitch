import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { execFileSync } from 'node:child_process';

const projectRoot = process.cwd();
const certDir = path.join(projectRoot, 'certs');
const keyPath = path.join(certDir, 'dev-key.pem');
const certPath = path.join(certDir, 'dev-cert.pem');

const isUsableIpv4 = (address) => (
  address
  && address.family === 'IPv4'
  && !address.internal
  && !address.address.startsWith('169.254.')
);

const normalizeExtraHosts = () => (
  (process.env.DEV_CERT_HOSTS || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
);

const detectHosts = () => {
  const hosts = new Set(['localhost', '127.0.0.1', '::1']);
  const networkInterfaces = os.networkInterfaces();
  const hostname = os.hostname();

  if (hostname) {
    hosts.add(hostname);
    if (!hostname.endsWith('.local')) {
      hosts.add(`${hostname}.local`);
    }
  }

  Object.values(networkInterfaces).flat().filter(isUsableIpv4).forEach((address) => {
    hosts.add(address.address);
  });

  normalizeExtraHosts().forEach((host) => hosts.add(host));

  return [...hosts];
};

const ensureMkcert = () => {
  try {
    execFileSync('mkcert', ['-help'], { stdio: 'ignore' });
  } catch {
    throw new Error('mkcert is not installed. Install it first, for example with `brew install mkcert`.');
  }
};

const installLocalCa = () => {
  try {
    execFileSync('mkcert', ['-install'], { stdio: 'inherit' });
    return true;
  } catch {
    console.warn('\nWarning: mkcert could not install the local root CA automatically.');
    console.warn('This usually means macOS needs your password to trust the certificate.');
    console.warn('Run `mkcert -install` manually in a normal terminal, then reload the browser.\n');
    return false;
  }
};

const main = () => {
  ensureMkcert();
  fs.mkdirSync(certDir, { recursive: true });

  const hosts = detectHosts();

  const caInstalled = installLocalCa();
  execFileSync('mkcert', ['-key-file', keyPath, '-cert-file', certPath, ...hosts], {
    stdio: 'inherit',
  });

  console.log('\nGenerated development certificate:');
  console.log(`- key: ${keyPath}`);
  console.log(`- cert: ${certPath}`);
  console.log(`- root CA trusted on this Mac: ${caInstalled ? 'yes' : 'manual step still needed'}`);
  console.log('- hosts:');
  hosts.forEach((host) => console.log(`  - ${host}`));
  console.log('\nIf you want additional hostnames, rerun with DEV_CERT_HOSTS="host1,host2".');
};

main();
