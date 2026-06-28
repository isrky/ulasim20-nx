import { plugins, server as serverPreset } from '../../libs/config/vite/vite.preset.js'
import fs from 'node:fs'
import path from 'node:path'
import { defineConfig } from 'vite'

const functionsSrc = path.resolve(__dirname, 'functions')
const functionsDest = path.resolve(__dirname, 'dist/functions')
const wranglerTomlSrc = path.resolve(__dirname, 'wrangler.toml')
const wranglerTomlDest = path.resolve(__dirname, 'dist/wrangler.toml')
const routesJsonDest = path.resolve(__dirname, 'dist/_routes.json')
const redirectsDest = path.resolve(__dirname, 'dist/_redirects')
const pluginMarker = path.resolve(__dirname, 'dist/.plugin-ran')

const routesJson = {
  version: 1,
  include: ['/denizli-api/*', '/api/*', '/route-api/*'],
  exclude: [],
}

const redirects =
  '# Cloudflare Pages: serve SPA shell for client-side routes\n' +
  '# Excluded function prefixes so they reach Functions instead of the shell.\n' +
  '/!denizli-api*/* /index.html 200\n' +
  '/!api*/* /index.html 200\n' +
  '/!route-api*/* /index.html 200\n' +
  '/* /index.html 200\n'

export default defineConfig({
  plugins: [
    ...plugins,
    {
      name: 'copy-cloudflare-functions',
      closeBundle() {
        fs.rmSync(functionsDest, { recursive: true, force: true })
        fs.cpSync(functionsSrc, functionsDest, { recursive: true })
        fs.writeFileSync(routesJsonDest, JSON.stringify(routesJson, null, 2))
        fs.writeFileSync(redirectsDest, redirects)
        if (fs.existsSync(wranglerTomlSrc)) fs.cpSync(wranglerTomlSrc, wranglerTomlDest)
        fs.writeFileSync(pluginMarker, `src=${functionsSrc}\ndest=${functionsDest}\n`)
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
