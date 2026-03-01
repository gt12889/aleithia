import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    dedupe: ['three'],
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api/data': {
        target: 'http://backend:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/data/, '/api/data'),
      },
    },
  },
})
