import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/',
  build: {
    // public/assets/* holds the site images; keep Vite's hashed output separate.
    assetsDir: 'static',
  },
})
