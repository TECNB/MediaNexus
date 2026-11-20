import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      ...Object.fromEntries(Array.from({ length: 9 }, (_, index) => {
        const prefix = `/douban-posters/img${index + 1}`
        return [`^${prefix}/view/photo/[a-z_]+/public/p[0-9]+\\.jpg$`, {
          target: `https://img${index + 1}.doubanio.com`,
          changeOrigin: true,
          headers: { Referer: 'https://movie.douban.com/', 'User-Agent': 'MediaNexus/1.0 (read-only public catalog)', Authorization: '', Cookie: '' },
          rewrite: (url: string) => url.slice(prefix.length),
        }]
      })),
      '/java-api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/java-api/, ''),
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
