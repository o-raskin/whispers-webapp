import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(scriptDir, '..')
const certDir = resolve(repoRoot, '.devcert')
const certPath = resolve(certDir, 'whispers-dev.crt')
const keyPath = resolve(certDir, 'whispers-dev.key')
const hostsPath = resolve(certDir, 'whispers-dev.hosts')
const opensslConfigPath = resolve(certDir, 'openssl.cnf')

function getUniqueHosts() {
  const configuredHosts = (process.env.VITE_DEV_CERT_HOSTS ?? 'localhost,127.0.0.1')
    .split(',')
    .map((host) => host.trim())
    .filter(Boolean)

  return [...new Set(configuredHosts)]
}

function getHostType(host) {
  return /^[\d.:]+$/.test(host) ? 'IP' : 'DNS'
}

function buildOpenSslConfig(hosts) {
  const altNames = hosts
    .map((host, index) => `${getHostType(host)}.${index + 1} = ${host}`)
    .join('\n')

  return `\
[req]
default_bits = 2048
prompt = no
default_md = sha256
x509_extensions = v3_req
distinguished_name = req_distinguished_name

[req_distinguished_name]
CN = ${hosts[0]}

[v3_req]
subjectAltName = @alt_names

[alt_names]
${altNames}
`
}

function currentHostsSignature(hosts) {
  return hosts.join('\n')
}

function hasMatchingCertHosts(hosts) {
  try {
    const previousHosts = readFileSync(hostsPath, 'utf8')
    return previousHosts === currentHostsSignature(hosts)
  } catch {
    return false
  }
}

function ensureCertificate() {
  const hosts = getUniqueHosts()

  mkdirSync(certDir, { recursive: true })

  if (hasMatchingCertHosts(hosts)) {
    return
  }

  rmSync(certPath, { force: true })
  rmSync(keyPath, { force: true })

  writeFileSync(opensslConfigPath, buildOpenSslConfig(hosts))

  execFileSync(
    'openssl',
    [
      'req',
      '-x509',
      '-nodes',
      '-newkey',
      'rsa:2048',
      '-keyout',
      keyPath,
      '-out',
      certPath,
      '-days',
      '365',
      '-config',
      opensslConfigPath,
      '-extensions',
      'v3_req',
    ],
    { stdio: 'inherit' },
  )

  writeFileSync(hostsPath, currentHostsSignature(hosts))
}

ensureCertificate()
