import { plugins, server as serverPreset } from '@ulasim20/config-vite'
import path from 'node:path'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins,
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  server: {
    ...serverPreset,
    proxy: {
      '/denizli-api': {
        target: 'https://ulasim.denizli.bel.tr',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/denizli-api/, '')
      },
      '/api': { target: 'http://localhost:8787', changeOrigin: true },
      '/route-api': {
        target: 'https://ulasimapi.isrky.dev',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/route-api/, '')
      }
    }
  },
  build: { outDir: 'dist' }
})
