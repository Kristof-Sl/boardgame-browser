import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/bgg': {
        target: 'https://boardgamegeek.com',
        changeOrigin: true,
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
})
