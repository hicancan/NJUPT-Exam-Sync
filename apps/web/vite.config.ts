import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
// https://vite.dev/config/
export default defineConfig(({ command }) => {
  const configuredPublic = process.env.NJUPT_SEARCH_WEB_PUBLIC_DIR
  const configuredOut = process.env.NJUPT_SEARCH_WEB_OUT_DIR
  if (command === 'build' && (!configuredPublic || !configuredOut)) {
    throw new Error(
      'production build requires NJUPT_SEARCH_WEB_PUBLIC_DIR and NJUPT_SEARCH_WEB_OUT_DIR',
    )
  }
  const publicDir = configuredPublic
    ? path.resolve(configuredPublic)
    : path.resolve(__dirname, 'public')
  const outDir = configuredOut
    ? path.resolve(configuredOut)
    : path.resolve(__dirname, '.vite-unused')

  return {
  root: __dirname,
  publicDir,
  build: {
    outDir,
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@njupt-search/academics-exam': path.resolve(__dirname, '../../academics/exam'),
      '@njupt-search/academics-exam/calendar': path.resolve(__dirname, '../../academics/exam/calendar.ts'),
      '@njupt-search/academics-room': path.resolve(__dirname, '../../academics/room/index.ts'),
      '@njupt-search/search-browser': path.resolve(__dirname, '../../search/browser/src/index.ts'),
    },
  },
  plugins: [
    react(),
    tailwindcss(),
  ],
  }
})
