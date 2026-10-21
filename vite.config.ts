import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync, writeFileSync } from 'node:fs'
import { runtimeLicenses } from './scripts/runtime-licenses.mjs'

export default defineConfig(({ mode }) => {
  const preview = mode === 'owner-preview'
  // Explicit private test build; ordinary web builds never read lesson content.
  const lessons = preview ? readFileSync('src/data/native-premium.json', 'utf8') : 'null'
  return {
    base: './',
    define: { __PREVIEW_COURSES__: lessons },
    plugins: [react(), {
      name: 'runtime-license-notices',
      generateBundle() {
        this.emitFile({ type: 'asset', fileName: 'THIRD_PARTY_LICENSES.txt', source: runtimeLicenses() })
      },
    }, ...(preview ? [{
      name: 'private-preview-cache',
      closeBundle() {
        const path = 'dist-owner-preview/sw.js'
        writeFileSync(path, readFileSync(path, 'utf8').replace("const RELEASE = 'v53'", "const RELEASE = 'v53-owner'"))
      },
    }] : [])],
    server: { host: true },
  }
})
