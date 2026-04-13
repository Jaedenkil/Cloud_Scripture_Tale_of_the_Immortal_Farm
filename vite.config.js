import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    outDir: 'dist/renderer'
  },
  server: {
    port: 5173
  }
})
