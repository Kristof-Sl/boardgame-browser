import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react()],
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
