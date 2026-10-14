/*
 * 프로젝트 하나의 서버 렌더 번들을 `dist/<프로젝트>/` 에 낸다(`client/` · `server/`) — 한 서버가 여럿을 Host 로 고를 때(PROJECTS_FILE)의 빌드.
 *   pnpm build:project a     # `.env.a` 를 읽는다(모드 = 프로젝트 이름) → dist/a/client · dist/a/server
 * 기본 `pnpm build`(dist/client · dist/server)는 그대로다.
 */
import { existsSync, readFileSync } from 'node:fs'
import { parseEnv } from 'node:util'
import { build } from 'vite'

const name = process.argv[2]
if (!name || !/^[a-z][a-z0-9-]*$/.test(name)) {
  console.error('usage: pnpm build:project <name>   (name: lower-case letters, digits, hyphens)')
  process.exit(2)
}
if (['production', 'development', 'test'].includes(name)) {
  console.error(`"${name}" is a Vite mode, not a project name`)
  process.exit(2)
}

// sitemap.xml · robots.txt 의 공개 주소는 이 프로젝트의 `.env.<이름>` 의 SITE_URL 만 쓴다 — 셸에 남은 다른 프로젝트의 SITE_URL 이 새지 않게(없으면 robots.txt 만)
const file = `.env.${name}`
const siteUrl = existsSync(file) ? parseEnv(readFileSync(file, 'utf8')).SITE_URL : undefined
if (siteUrl) process.env.SITE_URL = siteUrl
else {
  delete process.env.SITE_URL
  console.warn(`${file} has no SITE_URL — sitemap.xml is skipped (robots.txt only)`)
}

await build({ mode: name, build: { outDir: `dist/${name}/client`, emptyOutDir: true } })
await build({
  mode: name,
  build: { ssr: 'src/entry-server.tsx', outDir: `dist/${name}/server`, emptyOutDir: true },
})
