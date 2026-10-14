import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseEnv } from 'node:util'

/** Vite 의 기본 모드 — 이 밖의 이름으로 `vite build --mode <이름>` 하면 「프로젝트 빌드」다(`.env.<이름>` 을 읽는다) */
const DEFAULT_MODES = new Set(['production', 'development', 'test'])

/**
 * 프로젝트별 정적 빌드 검사. 정적 호스트(Cloudflare Pages)에는 `/api/v1` 이 없으므로 API 의 절대 주소(`VITE_API_BASE_URL`)가 없으면
 * 빌드를 멈춘다 — 빠뜨리고 올리면 모든 호출이 호스트의 HTML 404 로 간다. 기본 빌드 · 개발 서버는 건드리지 않는다.
 */
export function assertProjectBuildEnv(
  mode: string,
  command: 'build' | 'serve',
  env: Record<string, string | undefined>,
): void {
  if (command !== 'build' || DEFAULT_MODES.has(mode)) return
  if (!/^[a-z][a-z0-9-]*$/.test(mode))
    throw new Error(`project name must be lower-case letters, digits, hyphens (got "${mode}")`)
  const address = env.VITE_API_BASE_URL?.trim() ?? ''
  const host = /^https:\/\/([^\s/:]+)/.exec(address)?.[1]
  if (!host || host === 'localhost' || host.startsWith('127.') || host.endsWith('.localhost'))
    throw new Error(
      `project build "${mode}" needs VITE_API_BASE_URL — the public https address of this project's API (e.g. https://api.${mode}.example.com/api/v1), in apps/sample/.env.${mode} or the Pages build environment (not localhost, not http; the shared .env / .env.local do not count)`,
    )
}

/**
 * 프로젝트가 **스스로** 정한 값 — `.env.<이름>` · `.env.<이름>.local` 파일과 명시한 빌드 환경(셸 · Pages 대시보드)의 `VITE_*`.
 * 모두의 `.env` · `.env.local` 은 들어오지 않는다(프로젝트 아닌 값이 슬쩍 통과하거나 섞이지 않게). 기본 모드에서는 빈 객체.
 */
export function projectOwnEnv(
  mode: string,
  dir: string,
  shell: Record<string, string | undefined>,
): Record<string, string | undefined> {
  if (DEFAULT_MODES.has(mode)) return {}
  // Vite 와 같은 순서: 셸 > `.env.<이름>.local` > `.env.<이름>`
  const read = (name: string) => {
    const file = join(dir, name)
    return existsSync(file) ? parseEnv(readFileSync(file, 'utf8')) : {}
  }
  const own: Record<string, string | undefined> = {}
  for (const [key, value] of Object.entries({
    ...read(`.env.${mode}`),
    ...read(`.env.${mode}.local`),
    ...shell,
  }))
    if (key.startsWith('VITE_')) own[key] = value
  return own
}
