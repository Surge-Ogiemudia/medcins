import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  base: mode === 'production' ? '/medcins/' : '/',
  plugins: [react()],
  server: {
    allowedHosts: [
  'eight-bees-end.loca.lt',
  'gentle-toes-serve.loca.lt',
  'pharmastackdemo.loca.lt'
    ],
    // ...other server options...
  },
  build: {
    outDir: 'dist'
  }
}))
