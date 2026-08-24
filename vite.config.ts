import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        privacyPolicy: resolve(__dirname, 'privacy-policy.html'),
        support: resolve(__dirname, 'support.html'),
        authCallback: resolve(__dirname, 'auth-callback.html'),
        pushAdmin: resolve(__dirname, 'push-admin.html'),
      },
    },
  },
})
