import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import adminCollectionHandler from './api/admin-collection.js'

function localAdminCollectionApi() {
  return {
    name: 'local-admin-collection-api',
    configureServer(server) {
      server.middlewares.use('/api/admin-collection', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end(JSON.stringify({ error: 'Method not allowed.' }))
          return
        }

        try {
          const chunks = []
          for await (const chunk of req) chunks.push(chunk)
          const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')
          const response = {
            status(code) {
              res.statusCode = code
              return this
            },
            json(value) {
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify(value))
              return this
            },
          }
          await adminCollectionHandler({ method: req.method, body }, response)
        } catch (error) {
          res.statusCode = 400
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: error.message || 'Invalid request.' }))
        }
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const root = process.cwd()
  const htmlInputs = { index: resolve(root, 'index.html') }
  const meepleMapHtml = resolve(root, 'meeplemap.html')
  if (existsSync(meepleMapHtml)) htmlInputs.meeplemap = meepleMapHtml

  for (const key of ['VITE_SUPABASE_URL', 'ADMIN_PASSWORD', 'SUPABASE_SERVICE_ROLE_KEY']) {
    if (env[key]) process.env[key] = env[key]
  }

  return {
    plugins: [react(), localAdminCollectionApi()],
    build: { rollupOptions: { input: htmlInputs } },
    server: {
      proxy: {
        '/api/bgg': {
          target: 'https://boardgamegeek.com',
          changeOrigin: true,
          headers: {
            // Pass BGG_TOKEN from your local .env when developing
            ...(env.BGG_TOKEN ? { 'Authorization': `Bearer ${env.BGG_TOKEN}` } : {}),
          },
          rewrite: (path) => {
            const url = new URL(path, 'http://localhost')
            const params = Object.fromEntries(url.searchParams)
            const { path: bggPath, ...rest } = params
            const query = new URLSearchParams(rest).toString()
            return `/xmlapi2/${bggPath}${query ? '?' + query : ''}`
          },
        },
      },
    },
  }
})
