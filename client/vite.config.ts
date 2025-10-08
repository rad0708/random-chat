
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy: { '/socket.io': 'http://localhost:8080', '/health': 'http://localhost:8080', '/report': 'http://localhost:8080', '/admin': 'http://localhost:8080' } },
  build: { outDir: 'dist' }
})
