/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { configDefaults, defineConfig } from 'vitest/config'

const apiProxyTarget = process.env.API_PROXY_TARGET ?? 'http://localhost:8000'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: apiProxyTarget,
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    css: false,
    exclude: [...configDefaults.exclude, 'e2e/**'],
  },
})
