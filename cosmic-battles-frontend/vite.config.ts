/// <reference types="node" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Allow configuring ports via environment variables for Docker/CI
export default defineConfig(() => {
  const port = Number(process.env.PORT) || 5173
  const previewPort = Number(process.env.PREVIEW_PORT) || 4173

  return {
    plugins: [react()],
    server: {
      host: true, // listen on 0.0.0.0 for container access
      port,
      strictPort: true,
    },
    preview: {
      host: true,
      port: previewPort,
      strictPort: true,
    },
  }
})
