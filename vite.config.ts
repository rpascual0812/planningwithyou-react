import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // Optional: when VITE_API_BASE_URL is empty, proxy API paths to Django in dev.
  const apiTarget = env.VITE_DEV_API_PROXY_TARGET ?? 'http://localhost:8000'
  const apiPathPrefixes = [
    'token',
    'register',
    'verify-email',
    'reset-password',
    'accounts',
    'roles',
    'users',
    'companies',
    'emails',
    'contacts',
    'booking-',
    'calendar-',
    'documents',
    'document-',
    'packages',
    'package-',
    'subscriptions',
    'account-subscription',
    'config',
    'system-',
    'admin/',
    'public',
    'supplier-',
    'dashboard',
    'files',
    'webhooks',
    'form-templates',
    'email-templates',
    'support-tickets',
  ]

  const proxy: Record<string, object> = {}
  for (const prefix of apiPathPrefixes) {
    proxy[`^/${prefix}`] = {
      target: apiTarget,
      changeOrigin: true,
      secure: false,
    }
  }

  return {
    plugins: [react()],
    server: {
      proxy: env.VITE_API_BASE_URL ? undefined : proxy,
    },
  }
})
