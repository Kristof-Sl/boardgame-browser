import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs/promises'
import path from 'node:path'

function bggDetailsUploadPlugin() {
  const uploadMiddleware = (req, res, next) => {
    if (req.method !== 'POST') {
      next()
      return
    }

    const chunks = []
    req.on('data', chunk => chunks.push(chunk))
    req.on('end', async () => {
      try {
        const payload = JSON.parse(Buffer.concat(chunks).toString('utf8'))
        const games = Array.isArray(payload) ? payload : payload?.games
        if (!Array.isArray(games) || games.length === 0) {
          throw new Error('The JSON must contain a non-empty games array.')
        }

        const output = Array.isArray(payload)
          ? { version: 1, exportedAt: new Date().toISOString(), source: 'BoardGameGeek XML API v2', games: payload }
          : payload
        const target = path.resolve(process.cwd(), 'public', 'bgg-game-details.json')
        await fs.writeFile(target, JSON.stringify(output, null, 2) + '\n', 'utf8')

        res.statusCode = 200
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ games: games.length, filename: 'bgg-game-details.json' }))
      } catch (error) {
        res.statusCode = 400
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ error: error.message || 'Could not save the BGG details file.' }))
      }
    })
  }

  return {
    name: 'bgg-details-upload',
    configureServer(server) {
      server.middlewares.use('/api/upload-bgg-details', uploadMiddleware)
    },
    configurePreviewServer(server) {
      server.middlewares.use('/api/upload-bgg-details', uploadMiddleware)
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react(), bggDetailsUploadPlugin()],
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
