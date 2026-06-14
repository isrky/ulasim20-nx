// vite.config.js
import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import basicSsl from '@vitejs/plugin-basic-ssl'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { qrcode } from 'vite-plugin-qrcode'

const isRemote = process.env.REMOTE === 'true'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), ...(!isRemote ? [basicSsl()] : []), qrcode()],
  server: {
    allowedHosts: true,
    host: true,
    port: 3080,
    open: !isRemote,
    proxy: {
      // Denizli Ulaşım API proxy (CORS sorunlarını çözmek için)
      '/denizli-api': {
        target: 'https://ulasim.denizli.bel.tr',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/denizli-api/, ''),
      },
      // Backend API proxy (development)
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
      // Rota planlama API proxy (development)
      '/route-api': {
        target: 'https://ulasimapi.isrky.dev',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/route-api/, ''),
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
