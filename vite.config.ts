import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync, writeFileSync } from 'node:fs'

export default defineConfig(({ mode }) => {
  const preview = mode === 'owner-preview'
  // Explicit private test build; ordinary web builds never read lesson content.
  const lessons = preview ? readFileSync('src/data/native-premium.json', 'utf8') : 'null'
  return {
    base: './',
    define: { __PREVIEW_COURSES__: lessons },
    plugins: [react(), ...(preview ? [{
      name: 'private-preview-cache',
      closeBundle() {
        const path = 'dist-owner-preview/sw.js'
        writeFileSync(path, readFileSync(path, 'utf8').replace("const RELEASE = 'v32'", "const RELEASE = 'v32-owner'"))
      },
    }] : [])],
    server: { host: true },
  }
})
