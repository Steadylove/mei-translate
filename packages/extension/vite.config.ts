import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { crx } from '@crxjs/vite-plugin'
import { resolve } from 'path'
import manifest from './src/manifest.json'

export default defineConfig(({ mode }) => ({
  plugins: [react(), crx({ manifest })],
  define: {
    // Inject API URL based on mode
    'import.meta.env.VITE_API_URL': JSON.stringify(
      mode === 'development'
        ? 'http://localhost:8787'
        : 'https://webtrans-api.your-domain.workers.dev'
    ),
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    hmr: {
      port: 5173,
    },
  },
  build: {
    rollupOptions: {
      input: {
        options: resolve(__dirname, 'src/options/index.html'),
      },
    },
  },
}))
