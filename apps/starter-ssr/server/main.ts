/*
 * Node 서버 — 개발(`pnpm dev`: Vite 미들웨어 + 요청마다 서버 번들을 다시 읽는다)과 프로덕션(`pnpm start`: `vite build` 가 만든 `dist` 를 낸다).
 * 프로덕션 실행에는 node_modules 가 필요 없다 — 서버 번들(`dist/server/entry-server.js`)이 의존을 안에 담고, 이 파일은 node 내장 모듈만 쓴다
 * (개발에서만 `vite` 를 동적으로 불러온다). Node 22.18+ / 24 가 `.ts` 를 직접 읽는다(타입 제거).
 *
 *   node server/main.ts            # 프로덕션 — `dist/` 가 있어야 한다
 *   node server/main.ts --dev      # 개발 — HMR 이 있는 Vite 개발 서버
 * 환경변수: HOST · PORT · API_BASE_URL · SSR_API_TIMEOUT_MS · DIST_DIR · SITE_URL · PROJECTS_FILE (server/config.ts)
 * PROJECTS_FILE 이 있으면(프로덕션만) 한 서버가 요청 Host 로 프로젝트를 골라 그 프로젝트의 번들로 그린다 — server/projects.ts. 없으면 앱 하나(지금과 같다).
 */
import { readFile } from 'node:fs/promises'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { readServerConfig, type ServerConfig } from './config.ts'
import type { Render } from './contract.ts'
import { createHandler } from './handler.ts'
import { createProjectDispatcher, readProjects, type RequestHandler } from './projects.ts'

type Created = { server: Server; close: () => Promise<void> }
type RendererConfig = Pick<ServerConfig, 'apiBaseUrl' | 'apiTimeoutMs' | 'siteUrl'> & {
  forwardHost?: boolean
}
type ServerBundle = { createRenderer: (config: RendererConfig) => Render }

const APP_ROOT = fileURLToPath(new URL('..', import.meta.url))
const logError = (error: unknown, url: string) => console.error(`render failed for ${url}:`, error)

/** 빌드 결과 폴더 하나(`client/` · `server/`)로 요청을 받는 핸들러. 폴더마다 따로 만들어 서로 아무것도 나누지 않는다 */
async function createProductionHandler(distDir: string, renderer: RendererConfig) {
  const clientDir = join(distDir, 'client')
  const template = await readFile(join(clientDir, 'index.html'), 'utf8').catch(() => {
    throw new Error(`${clientDir}/index.html not found — run \`pnpm build\` first`)
  })
  const bundleUrl = pathToFileURL(join(distDir, 'server', 'entry-server.js')).href
  const bundle = (await import(bundleUrl)) as ServerBundle
  return createHandler({
    template: () => template,
    render: bundle.createRenderer(renderer),
    staticDir: clientDir,
    onError: logError,
  })
}

async function createProductionServer(config: ServerConfig): Promise<Created> {
  let handler: RequestHandler
  if (config.projectsFile) {
    // 한 서버 · 프로젝트 여럿 — 프로젝트마다 번들 · 템플릿 · 렌더러를 따로 읽어 두고 Host 로 고른다. 백엔드에는 방문자의 Host 를 넘긴다
    const projects = readProjects(
      JSON.parse(await readFile(config.projectsFile, 'utf8')) as unknown,
      dirname(config.projectsFile),
    )
    const handlers = new Map<string, RequestHandler>()
    for (const project of projects)
      handlers.set(
        project.name,
        await createProductionHandler(project.distDir, {
          apiBaseUrl: project.apiBaseUrl ?? config.apiBaseUrl,
          apiTimeoutMs: config.apiTimeoutMs,
          // 프로젝트의 공개 주소는 프로젝트가 정한다 — 없으면 canonical · og:url 을 빼고, 다른 프로젝트의 SITE_URL 로 대신하지 않는다
          siteUrl: project.siteUrl,
          forwardHost: true,
        }),
      )
    handler = createProjectDispatcher(projects, (project) => handlers.get(project.name)!)
  } else {
    handler = await createProductionHandler(config.distDir, config)
  }
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
if (dev && config.projectsFile)
  throw new Error(
    'PROJECTS_FILE works with the built server only — run `pnpm build:project <name>` for each project, then `pnpm start`',
  )
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
