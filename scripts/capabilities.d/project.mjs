// 스켈레톤의 카탈로그 → 찍은 프로젝트의 카탈로그: 고른 것만 남기고, 앱 이름을 바꾸고, 따라가지 않은 파일 경로를 걷고,
// 빠진 것은 omitted 에 한 줄씩(스켈레톤으로 가는 길과 함께).
import { existsSync } from 'node:fs'
import { join } from 'node:path'

const FILE_FIELDS = ['stories', 'patterns', 'docs']

const STARTERS = ['app-starter', 'app-starter-ssr']

/** 찍은 폴더에 실제로 남은 것: 경로가 있고(스켈레톤 도구는 빼고) · 앱은 새 이름의 스타터 하나 · 패턴은 필요한 것이 모두 남았을 때만 */
export function keepIdsFor(catalog, root, appFrom) {
  const kept = catalog.capabilities
    .filter((e) => e.stampFlag.included !== 'never')
    .filter((e) => !(STARTERS.includes(e.id) && e.id !== `app-${appFrom}`))
    .filter((e) => existsSync(join(root, e.path)) || e.path === `apps/${appFrom}`)
  const ids = new Set(kept.map((e) => e.id))
  return kept
    .filter((e) => e.kind !== 'pattern' || e.needs.every((n) => ids.has(n)))
    .map((e) => e.id)
}

export function projectCatalog(
  catalog,
  { root, projectName, appFrom, appTo, keepIds, scope, version = '0.1.0', pointer },
) {
  const keep = new Set(keepIds ?? keepIdsFor(catalog, root, appFrom))
  const exists = (path) => existsSync(join(root, path))
  // 스타터 이름이 글 속에도 있다(「서버 렌더 앱(app-starter-ssr)」) — 찍은 앱의 이름으로 바꾼다. `app-starter` 가 `app-starter-ssr` 안을 건드리지 않게 뒤를 본다
  const word = (name) => new RegExp(`${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\w-])`, 'g')
  const retarget = (value) =>
    JSON.parse(
      JSON.stringify(value)
        .replace(word(`app-${appFrom}`), `app-${appTo}`)
        .replace(word(`apps/${appFrom}`), `apps/${appTo}`),
    )
  const kept = catalog.capabilities
    .filter((e) => keep.has(e.id))
    .map((orig) => {
      const isApp = orig.path === `apps/${appFrom}`
      const e = retarget(orig)
      const next = {
        ...e,
        stampFlag: { flag: null, included: 'selected' },
        needs: e.needs.filter((n) => keep.has(n.replace(`app-${appTo}`, `app-${appFrom}`))),
      }
      if (isApp) next.package = appTo
      for (const field of FILE_FIELDS) next[field] = e[field].filter(exists)
      if (e.kind === 'app' || e.kind === 'script') next.entryPoints = e.entryPoints.filter(exists)
      return next
    })
  const omitted = catalog.capabilities
    .filter(
      (e) =>
        !keep.has(e.id) && e.stampFlag.included !== 'never' && e.stampFlag.included !== 'default',
    )
    .map((e) =>
      retarget({ id: e.id, kind: e.kind, summary: e.summary, stampFlag: e.stampFlag.flag }),
    )
  const out = {
    $schema: 'docs/capabilities.schema.json',
    schemaVersion: catalog.schemaVersion,
    mode: 'project',
    name: projectName,
    scope: scope ?? catalog.scope,
    version,
    summary: `${projectName} — ${catalog.name} 에서 찍은 프로젝트. 이 프로젝트에 들어 있는 기능만 적었다.`,
    skeleton: {
      name: catalog.name,
      version: catalog.version,
      pointer: pointer ?? `형제 레포 ${catalog.name} 의 capabilities.json (전체 카탈로그)`,
    },
    capabilities: kept,
    omitted,
  }
  if (catalog.guides) out.guides = catalog.guides.filter((g) => exists(g.path))
  return out
}
