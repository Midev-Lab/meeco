// Copies the single-file build to ./meeco.html: one file you can open, email or host anywhere.
import { copyFileSync } from 'node:fs'
copyFileSync('dist/index.html', 'meeco.html')
console.log('-> meeco.html')
