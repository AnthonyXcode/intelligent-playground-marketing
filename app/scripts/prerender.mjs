// Injects the server-rendered markup into dist/index.html, then removes the SSR bundle.
import { readFile, writeFile, rm } from 'node:fs/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const htmlPath = path.join(root, 'dist/index.html')
const ssrDir = path.join(root, 'dist-ssr')

const { render } = await import(pathToFileURL(path.join(ssrDir, 'entry-server.js')).href)
const template = await readFile(htmlPath, 'utf8')
if (!template.includes('<!--app-html-->')) throw new Error('dist/index.html is missing <!--app-html-->')
const html = template.replace('<!--app-html-->', () => render())
await writeFile(htmlPath, html)
await rm(ssrDir, { recursive: true, force: true })
console.log(`prerendered dist/index.html (${(html.length / 1024).toFixed(1)} KB)`)
