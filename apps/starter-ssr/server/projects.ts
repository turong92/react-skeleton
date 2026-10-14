import type { IncomingMessage, ServerResponse } from 'node:http'
import { resolve } from 'node:path'

/*
 * 한 서버에 프로젝트 여럿 — 프로젝트 목록 파일(`PROJECTS_FILE`)과 Host 로 프로젝트를 고르는 길잡이. 파일이 없으면 이 모듈은 쓰이지 않는다(지금과 같다).
 *
 *   { "projects": { "a": { "hosts": ["a.localhost", "a.example.com"], "distDir": "dist/a", "apiBaseUrl": "…", "siteUrl": "…" } } }
 *
 * `distDir` 은 `vite build` 결과 폴더(`client/` · `server/`) — 파일이 있는 폴더 기준 상대 경로. `apiBaseUrl` 은 필수(전역 API_BASE_URL 로 대신하지 않는다), `siteUrl` 은 빼면 canonical · og:url 이 빠진다.
 */
export type Project = {
  name: string
  /** 소문자 · 포트 없음. 이 Host 로 온 요청이 이 프로젝트다 */
  hosts: string[]
  /** 절대 경로 */
  distDir: string
  /** 이 프로젝트의 백엔드 — 필수. 프록시를 거치지 않는 내부 주소가 안전하다(docs/multi-project.md) */
  apiBaseUrl: string
  siteUrl?: string
}

/** 프로젝트 모드에서 Host 와 무관하게 200 을 내는 헬스 경로 */
export const HEALTH_PATH = '/healthz'

export type RequestHandler = (req: IncomingMessage, res: ServerResponse) => Promise<void>

/** `A.Localhost:3000` → `a.localhost`. 헤더가 없거나 비었으면 undefined */
export function hostOf(header: string | undefined): string | undefined {
  const raw = header?.trim().toLowerCase()
  if (!raw) return undefined
  const withoutPort = raw.startsWith('[') ? raw.replace(/:\d+$/, '') : raw.replace(/:\d*$/, '')
  return withoutPort.replace(/\.$/, '') || undefined
}

const NAME = /^[a-z][a-z0-9-]*$/
const HOST = /^(?:[a-z0-9-]+(?:\.[a-z0-9-]+)*|\[[0-9a-f:]+\])$/

type Raw = Record<string, unknown>
const isObject = (value: unknown): value is Raw =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
const text = (value: unknown) =>
  typeof value === 'string' && value.trim() ? value.trim() : undefined

/** 목록 파일 내용 → 프로젝트들. 못 쓰는 값은 추측하지 않고 던진다 */
export function readProjects(json: unknown, baseDir: string): Project[] {
  const entries = isObject(json) && isObject(json.projects) ? Object.entries(json.projects) : []
  if (entries.length === 0)
    throw new Error('projects file needs at least one project under "projects"')
  const owner = new Map<string, string>()
  return entries.map(([name, value]) => {
    if (!NAME.test(name))
      throw new Error(`project name must be lower-case letters, digits, hyphens (got "${name}")`)
    const raw = isObject(value) ? value : {}
    const hosts = Array.isArray(raw.hosts)
      ? raw.hosts.map((host) => String(host).trim().toLowerCase())
      : []
    if (hosts.length === 0) throw new Error(`project "${name}" needs a non-empty "hosts" list`)
    for (const host of hosts) {
      if (/:\d*$/.test(host) && !host.endsWith(']'))
        throw new Error(
          `project "${name}": host "${host}" must not carry a port (the port is ignored)`,
        )
      if (!HOST.test(host)) throw new Error(`project "${name}": "${host}" is not a host name`)
      const other = owner.get(host)
      if (other !== undefined)
        throw new Error(
          `host "${host}" belongs to both "${other}" and "${name}" — a request could not pick one`,
        )
      owner.set(host, name)
    }
    const distDir = text(raw.distDir)
    if (!distDir) throw new Error(`project "${name}" needs "distDir"`)
    // 전역 API_BASE_URL 로 대신하지 않는다 — 비워 두면 프로젝트가 다른 프로젝트의 백엔드로 가서 그 데이터를 그릴 수 있다
    const apiBaseUrl = text(raw.apiBaseUrl)?.replace(/\/+$/, '')
    if (!apiBaseUrl || !/^https?:\/\//.test(apiBaseUrl))
      throw new Error(
        `project "${name}" needs "apiBaseUrl" (absolute http(s) address of its backend)`,
      )
    return {
      name,
      hosts,
      distDir: resolve(baseDir, distDir),
      apiBaseUrl,
      siteUrl: text(raw.siteUrl)?.replace(/\/+$/, ''),
    }
  })
}

/**
 * 프로젝트마다 핸들러를 하나씩 만들어(`open`, 기동 때 한 번) 두고, 요청의 Host 로 고른다. 목록에 없는 Host 는 421 로 거절한다.
 * 핸들러(템플릿 · 렌더러 · 정적 폴더)가 프로젝트마다 따로라서 프로젝트 사이에 섞이는 서버 안 상태가 없다.
 * 같은 주소가 Host 에 따라 다른 내용이므로 응답에 `Vary: Host` — 중간 캐시가 프로젝트를 섞지 않는다.
 */
export function createProjectDispatcher(
  projects: Project[],
  open: (project: Project) => RequestHandler,
): RequestHandler {
  const byHost = new Map<string, RequestHandler>()
  for (const project of projects) {
    const handler = open(project)
    for (const host of project.hosts) byHost.set(host, handler)
  }
  return async (req, res) => {
    // 플랫폼 헬스체크는 컨테이너 안에서 `localhost` 로 온다 — Host 를 보지 않고, 어느 프로젝트도 고르지 않는다
    if (req.url === HEALTH_PATH) {
      res.writeHead(200, {
        'content-type': 'text/plain; charset=utf-8',
        'cache-control': 'no-store',
      })
      res.end('ok')
      return
    }
    const host = hostOf(req.headers.host)
    const handler = host === undefined ? undefined : byHost.get(host)
    res.setHeader('vary', 'Host')
    if (!handler) {
      res.writeHead(421, {
        'content-type': 'text/plain; charset=utf-8',
        'x-content-type-options': 'nosniff',
      })
      res.end('Misdirected Request')
      return
    }
    await handler(req, res)
  }
}
