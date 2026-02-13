import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import fs from 'fs'

// Copy index.html from public to root before Vite starts
const publicIndexPath = path.resolve(__dirname, 'public/index.html')
const rootIndexPath = path.resolve(__dirname, 'index.html')
if (fs.existsSync(publicIndexPath)) {
  fs.copyFileSync(publicIndexPath, rootIndexPath)
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const backendUrl = (env.VITE_API_URL || 'http://localhost:3000').replace(/\/+$/, '')

  return {
    plugins: [
      react(),
      // Plugin to ensure index.html is copied from public on server start
      {
        name: 'sync-index-html',
        configureServer() {
          if (fs.existsSync(publicIndexPath) && !fs.existsSync(rootIndexPath)) {
            fs.copyFileSync(publicIndexPath, rootIndexPath)
          }
        },
        buildStart() {
          if (fs.existsSync(publicIndexPath)) {
            fs.copyFileSync(publicIndexPath, rootIndexPath)
          }
        },
      },
    ],
    publicDir: 'public',
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        '@/shared': path.resolve(__dirname, '../shared/src'),
      },
    },
    server: {
      port: 3001,
      proxy: {
        '/api': {
          target: backendUrl,
          changeOrigin: true,
        },
      },
    },
  }
})

