import { plugins, server as serverPreset } from '../../libs/config/vite/vite.preset.js'
import fs from 'node:fs'
import path from 'node:path'
import { defineConfig } from 'vite'

const functionsSrc = path.resolve(__dirname, 'functions')
const functionsDest = path.resolve(__dirname, 'dist/functions')
const wranglerTomlSrc = path.resolve(__dirname, 'wrangler.toml')
const wranglerTomlDest = path.resolve(__dirname, 'dist/wrangler.toml')
const pluginMarker = path.resolve(__dirname, 'dist/.plugin-ran')

export default defineConfig({
  plugins: [
    ...plugins,
    {
      name: 'copy-cloudflare-functions',
      closeBundle() {
        fs.rmSync(functionsDest, { recursive: true, force: true })
        fs.cpSync(functionsSrc, functionsDest, { recursive: true })
        if (fs.existsSync(wranglerTomlSrc)) fs.cpSync(wranglerTomlSrc, wranglerTomlDest)
        fs.writeFileSync(pluginMarker, `src=${functionsSrc}\ndest=${functionsDest}\nwrangler.toml copied to dist/\n`)
      },
    },
  ],
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
