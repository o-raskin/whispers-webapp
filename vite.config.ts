import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

const repoRoot = dirname(fileURLToPath(import.meta.url))
const certDir = resolve(repoRoot, '.devcert')
const certPath = resolve(certDir, 'whispers-dev.crt')
const keyPath = resolve(certDir, 'whispers-dev.key')

function getHttpsConfig() {
  if (!existsSync(certPath) || !existsSync(keyPath)) {
    return undefined
  }

  return {
    cert: readFileSync(certPath),
    key: readFileSync(keyPath),
  }
}

function normalizeBackendOrigin(rawValue: string) {
  const normalizedValue = rawValue.startsWith('ws')
    ? rawValue.replace(/^ws/i, 'http')
    : rawValue

  return new URL(normalizedValue)
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const backendOrigin = normalizeBackendOrigin(
    env.VITE_BACKEND_ORIGIN ?? 'http://localhost:8080',
  )
  const https = getHttpsConfig()
  const proxy = {
    '/ws': {
      target: backendOrigin.origin,
      ws: true,
      changeOrigin: true,
      secure: false,
    },
    '/chats': {
      target: backendOrigin.origin,
      changeOrigin: true,
      secure: false,
    },
    '/messages': {
      target: backendOrigin.origin,
      changeOrigin: true,
      secure: false,
    },
    '/users': {
      target: backendOrigin.origin,
      changeOrigin: true,
      secure: false,
    },
  }

  return {
    plugins: [react()],
    server: {
      host: '0.0.0.0',
      https,
      proxy,
    },
    preview: {
      host: '0.0.0.0',
      https,
      proxy,
    },
  }
})
