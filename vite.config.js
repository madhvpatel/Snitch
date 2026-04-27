import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

// HTTPS certificates (for dev) - optional but fixes camera/mic restrictions on LAN URLs.
const certPath = path.resolve(__dirname, 'certs')
const preferredKeyPath = path.join(certPath, 'dev-key.pem')
const preferredCertPath = path.join(certPath, 'dev-cert.pem')
const legacyKeyPath = path.join(certPath, 'localhost-key.pem')
const legacyCertFilePath = path.join(certPath, 'localhost.pem')
const keyPath = fs.existsSync(preferredKeyPath) ? preferredKeyPath : legacyKeyPath
const certFilePath = fs.existsSync(preferredCertPath) ? preferredCertPath : legacyCertFilePath
const hasLocalCerts = fs.existsSync(keyPath) && fs.existsSync(certFilePath)
const key = hasLocalCerts ? fs.readFileSync(keyPath) : null
const cert = hasLocalCerts ? fs.readFileSync(certFilePath) : null

export default defineConfig({
  plugins: [react()],
  server: {
    https: hasLocalCerts ? {
      key,
      cert,
    } : false,
    host: true,                 // allow external connections
    port: 5173,                 // your dev port
    allowedHosts: 'all',        // allow ngrok hosts dynamically
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3001', // backend server
        changeOrigin: true,
        secure: false,
      },
      '/media': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
        secure: false,
      },
      '/python': {
        target: 'http://127.0.0.1:5001',
        rewrite: (path) => path.replace(/^\/python/, ''),
        changeOrigin: true,
        secure: false,
      },
    },
  },
})
