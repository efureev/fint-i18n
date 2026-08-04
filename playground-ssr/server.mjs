import { createServer as createHttpServer } from 'node:http'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import process from 'node:process'

/**
 * Минимальный SSR-сервер витрины: без Express и прочих зависимостей — у пакета
 * их нет, и заводить их ради демонстрации незачем.
 *
 *   node playground-ssr/server.mjs            # разработка, Vite в middleware
 *   node playground-ssr/server.mjs --prod     # из собранного playground-ssr/dist
 */
const root = fileURLToPath(new URL('./', import.meta.url))
const isProd = process.argv.includes('--prod')
const port = Number(process.env.PORT) || 3100

const PLACEHOLDER_HTML = '<!--app-html-->'
const PLACEHOLDER_STATE = /\/\*--app-state--\*\/null\/\*--\/app-state--\*\//

async function createDevServer() {
  const { createServer } = await import('vite')
  const vite = await createServer({
    root,
    configFile: new URL('./vite.config.ts', import.meta.url).pathname,
    appType: 'custom',
    server: { middlewareMode: true },
  })

  return {
    middlewares: vite.middlewares,
    async resolve(url) {
      const template = await vite.transformIndexHtml(url, readFileSync(`${root}index.html`, 'utf8'))
      const { render } = await vite.ssrLoadModule('/src/entry-server.ts')
      return { template, render }
    },
    fixStack: error => vite.ssrFixStacktrace(error),
  }
}

async function createProdServer() {
  const template = readFileSync(`${root}dist/client/index.html`, 'utf8')
  const { render } = await import(`${root}dist/server/entry-server.js`)

  return {
    middlewares: null,
    async resolve() {
      return { template, render }
    },
    fixStack: () => {},
  }
}

const server = isProd ? await createProdServer() : await createDevServer()

createHttpServer((req, res) => {
  const handle = async () => {
    try {
      const { template, render } = await server.resolve(req.url)
      const { html, payload } = await render(req.url)

      const page = template
        .replace(PLACEHOLDER_HTML, html)
        .replace(PLACEHOLDER_STATE, payload)

      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(page)
    }
    catch (error) {
      server.fixStack(error)
      console.error(error)
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' })
      res.end(String(error?.stack ?? error))
    }
  }

  if (server.middlewares) {
    server.middlewares(req, res, () => void handle())
    return
  }

  // В prod-режиме статику отдаёт сам Vite-билд рядом с HTML.
  if (req.url.startsWith('/assets/')) {
    try {
      const asset = readFileSync(`${root}dist/client${req.url.split('?')[0]}`)
      const type = req.url.endsWith('.css') ? 'text/css' : 'text/javascript'
      res.writeHead(200, { 'Content-Type': `${type}; charset=utf-8` })
      res.end(asset)
      return
    }
    catch {
      res.writeHead(404).end()
      return
    }
  }

  void handle()
}).listen(port, () => {
  console.log(`fint-i18n SSR playground → http://localhost:${port}/  (${isProd ? 'prod' : 'dev'})`)
  console.log(`  try  http://localhost:${port}/?locale=ru`)
  console.log(`  and  http://localhost:${port}/?locale=ru&hydrate=0`)
})
