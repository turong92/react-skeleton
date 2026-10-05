/*
 * Node 서버 — 개발(`pnpm dev`: Vite 미들웨어 + 요청마다 서버 번들을 다시 읽는다)과 프로덕션(`pnpm start`: `vite build` 가 만든 `dist` 를 낸다).
 * 프로덕션 실행에는 node_modules 가 필요 없다 — 서버 번들(`dist/server/entry-server.js`)이 의존을 안에 담고, 이 파일은 node 내장 모듈만 쓴다
 * (개발에서만 `vite` 를 동적으로 불러온다). Node 22.18+ / 24 가 `.ts` 를 직접 읽는다(타입 제거).
 *
 *   node server/main.ts            # 프로덕션 — `dist/` 가 있어야 한다
 *   node server/main.ts --dev      # 개발 — HMR 이 있는 Vite 개발 서버
 * 환경변수: HOST · PORT · API_BASE_URL · SSR_API_TIMEOUT_MS · DIST_DIR (server/config.ts)
 */
import { readFile } from 'node:fs/promises'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { readServerConfig, type ServerConfig } from './config.ts'
import type { Render } from './contract.ts'
import { createHandler } from './handler.ts'

type Created = { server: Server; close: () => Promise<void> }
type ServerBundle = {
  createRenderer: (config: Pick<ServerConfig, 'apiBaseUrl' | 'apiTimeoutMs'>) => Render
}

const APP_ROOT = fileURLToPath(new URL('..', import.meta.url))
const logError = (error: unknown, url: string) => console.error(`render failed for ${url}:`, error)

async function createProductionServer(config: ServerConfig): Promise<Created> {
  const clientDir = join(config.distDir, 'client')
  const template = await readFile(join(clientDir, 'index.html'), 'utf8').catch(() => {
    throw new Error(`${clientDir}/index.html not found — run \`pnpm build\` first`)
  })
  const bundleUrl = pathToFileURL(join(config.distDir, 'server', 'entry-server.js')).href
  const bundle = (await import(bundleUrl)) as ServerBundle
  const handler = createHandler({
    template: () => template,
    render: bundle.createRenderer(config),
    staticDir: clientDir,
    onError: logError,
  })
  const server = createServer((req, res) => void handler(req, res))
  return { server, close: async () => undefined }
}

async function createDevelopmentServer(config: ServerConfig): Promise<Created> {
  const { createServer: createVite } = await import('vite')
  const vite = await createVite({
    root: APP_ROOT,
    appType: 'custom',
    server: { middlewareMode: true },
  })
  const raw = await readFile(join(APP_ROOT, 'index.html'), 'utf8')
  const handler = createHandler({
    template: (url) => vite.transformIndexHtml(url, raw),
    render: async (url) => {
      const bundle = (await vite.ssrLoadModule('/src/entry-server.tsx')) as ServerBundle
      return bundle.createRenderer(config)(url)
    },
    onError: (error, url) => {
      if (error instanceof Error) vite.ssrFixStacktrace(error)
      logError(error, url)
    },
  })
  // Vite 가 먼저(모듈 · HMR · /api/v1 프록시 · public), 처리하지 않은 요청만 서버 렌더로
  const server = createServer((req, res) =>
    vite.middlewares(req, res, () => void handler(req, res)),
  )
  return { server, close: () => vite.close() }
}

const config = readServerConfig(process.env)
const dev = process.argv.includes('--dev')
const { server, close } = await (dev
  ? createDevelopmentServer(config)
  : createProductionServer(config))

server.listen(config.port, config.host, () => {
  const { port } = server.address() as AddressInfo
  const mode = dev ? 'development' : 'production'
  console.log(`listening on http://${config.host}:${port} (${mode}, backend ${config.apiBaseUrl})`)
})

function shutdown() {
  server.close(() => void close().then(() => process.exit(0)))
  server.closeAllConnections()
  setTimeout(() => process.exit(0), 2000).unref()
}
process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)
