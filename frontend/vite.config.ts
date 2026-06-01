import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Use './' for GitHub Pages (relative asset paths)
  // Change to '/' for Vercel/Netlify or when served from domain root
  base: process.env.GITHUB_ACTIONS ? '/EventDrivenModule/' : '/',
  server: {
    port: 5173,
  },
})

