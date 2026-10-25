import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// The web app talks to a small local API (./server) for enquiries and search.
// Requests are proxied so the browser only ever calls same-origin URLs — the
// browser is never told where the API lives, so there is nothing to configure
// per environment and no cross-origin preflight to get wrong.
//
// `allowedHosts: true` exists because the dev server is reached through a
// preview proxy with a rotating hostname. It applies to `vite dev` only; the
// production build is served by a real web server which sets its own
// `server_name`.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: false,
    allowedHosts: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: true,
      },
    },
  },
  preview: { host: '0.0.0.0', port: 4173, allowedHosts: true },
  build: { target: 'es2022', cssMinify: true },
})
