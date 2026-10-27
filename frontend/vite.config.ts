import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 5180, strictPort: true, proxy: {
    '/api': { target: process.env.VOXTRACE_API_TARGET || 'http://127.0.0.1:8010', changeOrigin: true,
      rewrite: path => path.replace(/^\/api/, '') },
  } },
})
