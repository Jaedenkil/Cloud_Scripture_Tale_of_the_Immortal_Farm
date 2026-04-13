import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  build: {
    outDir: 'dist/renderer'
  },
  server: {
    port: 5173
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  }
})
