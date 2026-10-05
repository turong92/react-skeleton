import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export type ServerConfig = {
  /** 듣는 주소 — 기본은 loopback. 컨테이너에서는 `HOST=0.0.0.0` */
  host: string
  /** 0 이면 빈 포트를 고른다 */
  port: number
  /** 서버 렌더가 부르는 백엔드(절대 주소 — 서버에는 origin 이 없다). 브라우저는 같은 origin 의 `/api/v1` 을 부른다 */
  apiBaseUrl: string
  /** 서버 렌더 중 백엔드 호출을 기다리는 최대 시간 — 넘으면 데이터 없이 그린다(클라이언트가 다시 부른다) */
  apiTimeoutMs: number
  /** `vite build` 결과(`client/` · `server/`) 폴더 */
  distDir: string
  /** 사이트의 공개 주소(`https://notes.example.com`) — canonical · `og:url` · 사이트맵의 바탕. 없으면 그 태그를 빼고 추측한 주소를 쓰지 않는다 */
  siteUrl?: string
}

type Env = Record<string, string | undefined>

function integer(
  env: Env,
  name: string,
  fallback: number,
  { min, max }: { min: number; max: number },
) {
  const raw = env[name]?.trim()
  if (!raw) return fallback
  const value = Number(raw)
  if (!Number.isInteger(value) || value < min || value > max)
    throw new Error(`${name} must be an integer between ${min} and ${max} (got "${raw}")`)
  return value
}

/** 환경변수 → 설정. 못 쓰는 값은 추측하지 않고 던진다 */
export function readServerConfig(env: Env): ServerConfig {
  const apiBaseUrl = (env.API_BASE_URL?.trim() || 'http://localhost:8080/api/v1').replace(
    /\/+$/,
    '',
  )
  if (!/^https?:\/\//.test(apiBaseUrl))
    throw new Error(`API_BASE_URL must be an absolute http(s) url (got "${apiBaseUrl}")`)
  const siteUrl = env.SITE_URL?.trim().replace(/\/+$/, '') || undefined
  if (siteUrl !== undefined && !/^https?:\/\/[^\s/]+$/.test(siteUrl))
    throw new Error(
      `SITE_URL must be an absolute http(s) origin like https://example.com (got "${siteUrl}")`,
    )
  return {
    host: env.HOST?.trim() || '127.0.0.1',
    port: integer(env, 'PORT', 3000, { min: 0, max: 65535 }),
    apiBaseUrl,
    apiTimeoutMs: integer(env, 'SSR_API_TIMEOUT_MS', 2000, { min: 1, max: 60_000 }),
    distDir: env.DIST_DIR?.trim() || join(dirname(fileURLToPath(import.meta.url)), '..', 'dist'),
    siteUrl,
  }
}
