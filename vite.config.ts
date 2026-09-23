import { resolve } from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Vite config for Tauri frontend
export default defineConfig({
  root: 'src/renderer',
  publicDir: resolve('resources'),
  resolve: {
    alias: {
      '@renderer': resolve('src/renderer/src')
    }
  },
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true
  },
  build: {
    outDir: resolve('out/renderer'),
    emptyOutDir: true
  }
})
