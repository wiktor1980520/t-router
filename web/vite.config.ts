import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'package.json'), 'utf-8'))
let buildInfo = { build: 0 }
try {
  buildInfo = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'build_info.json'), 'utf-8'))
} catch {
  // If build_info.json doesn't exist, we can create it or default to 0
  fs.writeFileSync(path.resolve(__dirname, 'build_info.json'), JSON.stringify({ build: 0 }))
}

const readWranglerVar = (key: string): string => {
  const wranglerPath = path.resolve(__dirname, 'wrangler.toml')
  if (!fs.existsSync(wranglerPath)) return ''

  const content = fs.readFileSync(wranglerPath, 'utf-8')
  const re = new RegExp(`^\\s*${key}\\s*=\\s*"(.*?)"\\s*$`, 'm')
  const m = content.match(re)
  return (m?.[1] || '').trim()
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')

  const rawApiBase = (env.VITE_API_BASE_URL || '').trim()
  const resolvedApiBase = rawApiBase || readWranglerVar('VITE_API_BASE_URL')
  const proxyTarget = resolvedApiBase
    ? resolvedApiBase.replace(/\/+$/, '').replace(/\/(api|v1)$/, '')
    : ''

  return {
    plugins: [react()],
    define: {
      __APP_VERSION__: JSON.stringify(`v${pkg.version}.${buildInfo.build}`),
      ...(rawApiBase ? {} : (resolvedApiBase ? { 'import.meta.env.VITE_API_BASE_URL': JSON.stringify(resolvedApiBase) } : {})),
    },
    server: proxyTarget
      ? {
          proxy: {
            '/api': {
              target: proxyTarget,
              changeOrigin: true,
              secure: true,
            },
            '/v1': {
              target: proxyTarget,
              changeOrigin: true,
              secure: true,
            },
          },
        }
      : undefined,
  }
})
