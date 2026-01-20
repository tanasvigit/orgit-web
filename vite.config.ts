import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import fs from 'fs'

// Copy index.html from public to root before Vite starts
const publicIndexPath = path.resolve(__dirname, 'public/index.html')
const rootIndexPath = path.resolve(__dirname, 'index.html')
if (fs.existsSync(publicIndexPath)) {
  fs.copyFileSync(publicIndexPath, rootIndexPath)
}

export default defineConfig({
  plugins: [
    react(),
    // Plugin to ensure index.html is copied from public on server start
    {
      name: 'sync-index-html',
      configureServer() {
        // Ensure index.html exists in root (serves as entry point)
        if (fs.existsSync(publicIndexPath) && !fs.existsSync(rootIndexPath)) {
          fs.copyFileSync(publicIndexPath, rootIndexPath)
        }
      },
      buildStart() {
        // Copy index.html from public to root at build start
        if (fs.existsSync(publicIndexPath)) {
          fs.copyFileSync(publicIndexPath, rootIndexPath)
        }
      },
    },
  ],
  // Public directory for static assets
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
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
})

