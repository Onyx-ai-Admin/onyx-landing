// Partner links live at onyx-tech.ai/<code> (no ?ref=). GitHub Pages is static, so each
// code gets a folder holding a copy of index.html, and 404.html is a copy too so a code
// without a folder still lands on the page (the script reads the code from the path).
// Run after ANY edit to index.html:  node make-links.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
const CODES = ['enrique', 'zacrule']
const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8')
// The copies are served one folder down (and 404.html from anywhere), so every relative
// URL in the page has to become root-relative or the images and the About link 404.
const rooted = html
  .replace(/\b(href|src|poster|action)="(?!#|\/|https?:|data:|mailto:|tel:|javascript:)/g, '$1="/')
  .replace(/url\((['"]?)(?!#|\/|https?:|data:)/g, 'url($1/')
  .replace(/(['"])assets\//g, '$1/assets/')
for (const code of CODES) {
  mkdirSync(code, { recursive: true })
  writeFileSync(`${code}/index.html`, rooted.replace('<meta property="og:url" content="https://onyx-tech.ai/">', `<meta property="og:url" content="https://onyx-tech.ai/${code}/">`))
}
writeFileSync('404.html', rooted)
console.log('wrote', CODES.map((c) => `${c}/index.html`).join(', '), 'and 404.html')
