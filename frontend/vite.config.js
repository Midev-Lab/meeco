import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'
import { fileURLToPath } from 'node:url'

// jsPDF lazily imports html2canvas / canvg / dompurify for features meeco never uses
// (HTML -> PDF, SVG). Aliasing them to an empty module keeps the single file lean.
const stub = fileURLToPath(new URL('./src/lib/empty.js', import.meta.url))

export default defineConfig({
  plugins: [react(), viteSingleFile()],
  resolve: { alias: { html2canvas: stub, canvg: stub, dompurify: stub } },
  build: {
    target: 'es2020',
    assetsInlineLimit: 100000000,
    chunkSizeWarningLimit: 4000,
  },
})
