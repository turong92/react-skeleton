/*
 * 프로젝트 하나의 서버 렌더 번들을 `dist/<프로젝트>/` 에 낸다(`client/` · `server/`) — 한 서버가 여럿을 Host 로 고를 때(PROJECTS_FILE)의 빌드.
 *   pnpm build:project a     # `.env.a` 를 읽는다(모드 = 프로젝트 이름) → dist/a/client · dist/a/server
 * 기본 `pnpm build`(dist/client · dist/server)는 그대로다.
 */
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

await build({ mode: name, build: { outDir: `dist/${name}/client`, emptyOutDir: true } })
await build({
  mode: name,
  build: { ssr: 'src/entry-server.tsx', outDir: `dist/${name}/server`, emptyOutDir: true },
})
