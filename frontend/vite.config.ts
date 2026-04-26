import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        // Use IPv4 explicitly to avoid Windows localhost/IPv6 (::1) issues.
        target: 'http://127.0.0.1:8080',
        changeOrigin: true,
      },
    },
  },
})
