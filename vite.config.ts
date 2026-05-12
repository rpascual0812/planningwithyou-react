import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // When VITE_API_BASE_URL is empty (the default in `.env.example`), all `/api/*`
  // requests from the browser are proxied through the Vite dev server to the
  // Django backend. This sidesteps CORS in development entirely.
  const apiTarget = env.VITE_DEV_API_PROXY_TARGET ?? 'http://localhost:8000'

  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
          secure: false,
        },
      },
    },
  }
})
