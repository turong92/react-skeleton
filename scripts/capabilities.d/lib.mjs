// capabilities.json 가드 — 카탈로그가 레포의 실제와 어긋나면 무엇을 고치라고 말하는 문장을 돌려준다(빈 배열 = 통과).
// 스켈레톤과 찍힌 프로젝트가 같은 가드를 쓴다(scripts/build-capabilities.mjs · tests/capabilities.test.ts).
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, isAbsolute, join, normalize } from 'node:path'
import { renderCapabilitiesMd, renderLlmsTxt } from './render.mjs'
import { validate } from './schema.mjs'

export const CATALOG_FILE = 'capabilities.json'
export const SCHEMA_FILE = 'docs/capabilities.schema.json'
const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'))
const text = (path) => readFileSync(path, 'utf8')
const HANGUL = /[ᄀ-ᇿㄱ-ㆎ가-힣]/

export const loadCatalog = (root) => readJson(join(root, CATALOG_FILE))
export const loadSchema = (root) => readJson(join(root, SCHEMA_FILE))

/** packages/* · apps/* 의 폴더 + package.json */
export function workspaces(root) {
  const find = (group, kind) => {
    const base = join(root, group)
    if (!existsSync(base)) return []
    return readdirSync(base)
      .filter((name) => existsSync(join(base, name, 'package.json')))
      .sort()
      .map((name) => ({
        kind,
        dir: name,
        path: `${group}/${name}`,
        json: readJson(join(base, name, 'package.json')),
      }))
  }
  return [...find('packages', 'package'), ...find('apps', 'app')]
}

const entryHint = (ws, scope) => {
  const id = ws.kind === 'app' ? `app-${ws.dir}` : ws.dir
  const stub = {
    id,
    kind: ws.kind,
    summary: '<한 문장: 이것으로 사용자가 얻는 것>',
    package: ws.json.name,
    path: ws.path,
    status: 'stable',
    stampFlag:
      ws.kind === 'package'
        ? {
            flag: `--packages ${ws.dir}`,
            included: 'flag',
            autoIncludes: [],
            alsoVia: [],
            optOut: null,
          }
        : { flag: null, included: 'flag', autoIncludes: [], alsoVia: [], optOut: null },
    needs: Object.keys(ws.json.dependencies ?? {})
      .filter((d) => d.startsWith(`${scope}/`))
      .map((d) => d.slice(scope.length + 1)),
    backend: null,
    entryPoints: [],
    stories: [],
    patterns: [],
    docs: [`${ws.path}/README.md`],
    notFor: ['<쓰지 않는 경우와 대신 쓸 것>'],
    keywords: { ko: ['<주인이 하는 말>'], en: ['<what the owner says>'] },
  }
  return JSON.stringify(stub, null, 2)
}

export const checkSchema = (catalog, schema) =>
  validate(catalog, schema, schema).map((p) => `${CATALOG_FILE}: ${p.replace(/^\$\.?/, '')}`)

export function checkCoverage(catalog, root) {
  const problems = []
  const scope = catalog.scope
  const seen = new Set()
  for (const e of catalog.capabilities) {
    if (seen.has(e.id))
      problems.push(`${CATALOG_FILE}: duplicate id "${e.id}" — ids must be unique`)
    seen.add(e.id)
  }
  const spaces = workspaces(root)
  for (const ws of spaces) {
    if (catalog.capabilities.some((e) => e.kind === ws.kind && e.path === ws.path)) continue
    problems.push(
      `${ws.path} has no entry in ${CATALOG_FILE}. Add this object to "capabilities" (fill in the <…> parts; fields are described in ${SCHEMA_FILE}), then run \`pnpm capabilities\`:\n${entryHint(ws, scope)}`,
    )
  }
  for (const e of catalog.capabilities.filter((x) => x.kind === 'package' || x.kind === 'app')) {
    const ws = spaces.find((w) => w.kind === e.kind && w.path === e.path)
    if (!ws)
      problems.push(
        `${CATALOG_FILE}: entry "${e.id}" points at ${e.path}, which does not exist as a ${e.kind} — remove the entry (or fix its path)`,
      )
    else if (ws.json.name !== e.package)
      problems.push(
        `${CATALOG_FILE}: entry "${e.id}" says package ${e.package} but ${e.path}/package.json is named ${ws.json.name}`,
      )
  }
  const packageNames = new Set(
    catalog.capabilities.filter((e) => e.kind === 'package').map((e) => e.package),
  )
  for (const e of catalog.capabilities.filter((x) => x.kind === 'pattern'))
    if (!packageNames.has(e.package))
      problems.push(
        `${CATALOG_FILE}: pattern "${e.id}" says it lives in ${e.package}, which is not a package entry`,
      )
  return problems
}

const insideRepo = (path) => !isAbsolute(path) && !normalize(path).startsWith('..')

export function checkPaths(catalog, root) {
  const problems = []
  const check = (e, field, path, wantFile = false) => {
    if (!insideRepo(path))
      return problems.push(
        `${CATALOG_FILE}: ${e.id}.${field} "${path}" leaves the repo — paths are relative to the repo root`,
      )
    const full = join(root, path)
    if (!existsSync(full))
      return problems.push(
        `${CATALOG_FILE}: ${e.id}.${field} "${path}" does not exist — fix the path or drop it`,
      )
    if (wantFile && !statSync(full).isFile())
      problems.push(`${CATALOG_FILE}: ${e.id}.${field} "${path}" is not a file`)
  }
  for (const e of catalog.capabilities) {
    check(e, 'path', e.path)
    for (const field of ['stories', 'patterns', 'docs'])
      for (const p of e[field]) check(e, field, p, true)
    if (e.kind === 'app' || e.kind === 'script')
      for (const p of e.entryPoints) check(e, 'entryPoints', p, true)
  }
  return problems
}

// ------------------------------------------------------------------------------------------------ exports
const stripComments = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
export function exportedNames(file, seen = new Set()) {
  if (seen.has(file) || !existsSync(file)) return new Set()
  seen.add(file)
  const src = stripComments(text(file))
  const names = new Set()
  for (const m of src.matchAll(/export\s+(?:type\s+)?\{([^}]*)\}/g))
    for (const part of m[1].split(',')) {
      const name = part
        .trim()
        .replace(/^type\s+/, '')
        .split(/\s+as\s+/)
        .pop()
      if (name) names.add(name)
    }
  for (const m of src.matchAll(
    /export\s+(?:declare\s+)?(?:async\s+)?(?:abstract\s+)?(?:function\*?|const|let|var|class|enum|interface|type)\s+([A-Za-z_$][\w$]*)/g,
  ))
    names.add(m[1])
  if (/export\s+default\b/.test(src)) names.add('default')
  for (const m of src.matchAll(/export\s+\*\s+from\s+['"](\.[^'"]+)['"]/g)) {
    const target = [m[1], `${m[1]}.ts`, `${m[1]}.tsx`, `${m[1]}/index.ts`]
      .map((p) => join(dirname(file), p))
      .find((p) => existsSync(p) && statSync(p).isFile())
    if (target) for (const n of exportedNames(target, seen)) names.add(n)
  }
  return names
}

const exportTarget = (value) =>
  typeof value === 'string' ? value : (value?.default ?? value?.types)

export function checkExports(catalog, root) {
  const problems = []
  const spaces = workspaces(root).filter((w) => w.kind === 'package')
  for (const e of catalog.capabilities.filter(
    (x) => x.kind === 'package' || x.kind === 'pattern',
  )) {
    const ws = spaces.find((w) => w.json.name === e.package)
    if (!ws) continue // 어느 패키지인지는 coverage 가드가 말한다
    for (const point of e.entryPoints) {
      const [spec, name = point] = point.includes('#') ? point.split('#') : [e.package, point]
      const sub = spec === ws.json.name ? '.' : `.${spec.slice(ws.json.name.length)}`
      const target = exportTarget(ws.json.exports?.[sub])
      if (!target) {
        problems.push(
          `${CATALOG_FILE}: ${e.id}.entryPoints "${point}" — ${ws.path}/package.json has no exports["${sub}"] (subpath ${spec})`,
        )
        continue
      }
      const file = join(root, ws.path, target)
      if (!exportedNames(file).has(name))
        problems.push(
          `${CATALOG_FILE}: ${e.id}.entryPoints "${name}" is not exported by ${ws.path}/${target.replace(/^\.\//, '')} (exports["${sub}"]) — fix the name or drop it`,
        )
    }
  }
  return problems
}

export function checkNeeds(catalog, root) {
  const problems = []
  const ids = new Set(catalog.capabilities.map((e) => e.id))
  const idOfPackage = new Map(
    catalog.capabilities.filter((e) => e.kind === 'package').map((e) => [e.package, e.id]),
  )
  for (const e of catalog.capabilities) {
    for (const need of e.needs)
      if (!ids.has(need))
        problems.push(`${CATALOG_FILE}: ${e.id}.needs "${need}" is not an id in the catalog`)
  }
  for (const ws of workspaces(root).filter((w) => w.kind === 'package')) {
    const e = catalog.capabilities.find((x) => x.kind === 'package' && x.path === ws.path)
    if (!e) continue
    const deps = Object.keys(ws.json.dependencies ?? {})
      .filter((d) => d.startsWith(`${catalog.scope}/`))
      .map((d) => idOfPackage.get(d) ?? d.slice(catalog.scope.length + 1))
    for (const dep of deps.filter((d) => !e.needs.includes(d)))
      problems.push(
        `${CATALOG_FILE}: ${e.id} needs ${JSON.stringify(e.needs)} but ${ws.path}/package.json depends on ${catalog.scope}/${dep} — add "${dep}" to ${e.id}.needs`,
      )
    for (const need of e.needs.filter((n) => !deps.includes(n)))
      if (idOfPackage.has(`${catalog.scope}/${need}`))
        problems.push(
          `${CATALOG_FILE}: ${e.id}.needs lists "${need}" but ${ws.path}/package.json does not depend on it — remove it from needs`,
        )
  }
  return problems
}

export function checkKeywords(catalog) {
  const problems = []
  for (const e of catalog.capabilities) {
    for (const lang of ['ko', 'en']) {
      const list = e.keywords?.[lang]
      if (!Array.isArray(list) || list.length === 0) {
        problems.push(
          `${CATALOG_FILE}: ${e.id}.keywords.${lang} is empty — add the words an owner would say (${lang === 'ko' ? '한국어' : 'English'})`,
        )
        continue
      }
      // 한국어 목록에는 한글 낱말이 있어야 한다(JWT · SEO 같은 약어는 섞여도 된다). 영어 목록에는 한글이 없다
      if (lang === 'ko' && !list.some((word) => HANGUL.test(word)))
        problems.push(
          `${CATALOG_FILE}: ${e.id}.keywords.ko has no Korean word (got ${JSON.stringify(list)}) — the languages are swapped? put English words in keywords.en`,
        )
      if (lang === 'en')
        for (const word of list.filter((w) => HANGUL.test(w)))
          problems.push(
            `${CATALOG_FILE}: ${e.id}.keywords.en has "${word}" with Hangul — put it in keywords.ko`,
          )
    }
  }
  return problems
}

export const GENERATED = [
  ['docs/capabilities.md', renderCapabilitiesMd],
  ['llms.txt', renderLlmsTxt],
]

export function checkGenerated(catalog, root) {
  const problems = []
  for (const [file, render] of GENERATED) {
    const path = join(root, file)
    if (!existsSync(path) || text(path) !== render(catalog))
      problems.push(
        `${file} is missing or out of date with ${CATALOG_FILE} — run \`pnpm capabilities\` and commit the result (do not edit ${file} by hand)`,
      )
  }
  return problems
}

/** 한꺼번에 — 스키마가 틀리면 나머지는 의미가 없어 스키마 문제만 돌려준다 */
export function checkCatalog(root) {
  const catalog = loadCatalog(root)
  const schema = checkSchema(catalog, loadSchema(root))
  if (schema.length) return schema
  return [
    ...checkCoverage(catalog, root),
    ...checkPaths(catalog, root),
    ...checkExports(catalog, root),
    ...checkNeeds(catalog, root),
    ...checkKeywords(catalog),
    ...checkGenerated(catalog, root),
  ]
}
