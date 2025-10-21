import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
    server: {
    allowedHosts: [
      'eight-bees-end.loca.lt',
      'gentle-toes-serve.loca.lt',
      'medcinsdemo.loca.lt'
    ],
      // ...other server options...
    },
  build: {
    outDir: 'dist'
  }
})
