import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const backendProxyTarget =
    process.env.ALEITHIA_DEV_BACKEND_PROXY_TARGET ||
    env.ALEITHIA_DEV_BACKEND_PROXY_TARGET ||
    'http://localhost:8000'

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      dedupe: ['three'],
    },
    server: {
      host: '0.0.0.0',
      port: 5173,
      proxy: {
        '/api/data': {
          target: backendProxyTarget,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/data/, '/api/data'),
        },
      },
    },
  }
})
