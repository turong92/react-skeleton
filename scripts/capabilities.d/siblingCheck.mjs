// 짝 레포(kotlin-skeleton)의 카탈로그와 이 카탈로그가 같은 말을 하는가 — 읽기만 한다(옆 레포를 고치지 않는다).
// kotlin 쪽의 반대 방향 가드는 그쪽 CapabilitiesGuards.frontend 가 맡는다(`tests/support` 의 문서 참고). 이 스켈레톤 전용(찍힌 프로젝트에는 옆 레포가 없다).
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fragmentFor } from './fragment.mjs'

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'))
const sameSet = (a, b) => a.length === b.length && a.every((x) => b.includes(x))
/** `--packages a,b` 에서 빼야 할 패키지를 뺀다 — 남는 것이 없으면 null */
function flagWithout(flag, drop) {
  if (!flag) return null
  const m = /^--packages (\S+)(.*)$/.exec(flag)
  if (!m) return flag
  const kept = m[1].split(',').filter((p) => !drop.has(p))
  const rest = m[2].trim()
  const parts = [...(kept.length ? [`--packages ${kept.join(',')}`] : []), ...(rest ? [rest] : [])]
  return parts.join(' ') || null
}
const list = (a) => [...a].sort().join(', ') || '(none)'

const backendModules = (b) => [
  ...(b?.modules ?? []),
  ...(b?.oneOfModules ?? []).flat(),
  ...(b?.optionalModules ?? []),
]

/** apps/<app>/build.gradle.kts 가 끌어오는 모듈의 닫힘(직접 선언 + 모듈끼리의 project 의존) */
export function gradleClosure(kotlinRoot, app) {
  const deps = (file) =>
    existsSync(file)
      ? [...readFileSync(file, 'utf8').matchAll(/project\(":modules:([a-z0-9-]+)"\)/g)].map(
          (m) => m[1],
        )
      : []
  const seen = new Set()
  const walk = (m) => {
    if (seen.has(m)) return
    seen.add(m)
    deps(join(kotlinRoot, 'modules', m, 'build.gradle.kts')).forEach(walk)
  }
  deps(join(kotlinRoot, 'apps', app, 'build.gradle.kts')).forEach(walk)
  return [...seen].sort()
}

/**
 * @param {object} react 이 레포의 capabilities.json
 * @param {object} kotlin 짝 레포의 capabilities.json
 * @param {string} kotlinRoot 짝 레포 경로(문서 · gradle 파일을 읽는다)
 * @returns {string[]} 어긋남(빈 배열 = 일치)
 */
export function checkAgainstKotlin(react, kotlin, kotlinRoot) {
  const problems = []
  const kEntries = kotlin.capabilities
  const kByModule = new Map(kEntries.filter((e) => e.module).map((e) => [e.module, e]))
  const kById = new Map(kEntries.map((e) => [e.id, e]))

  // 1. 이 카탈로그가 옮겨 적은 kotlin 의 new-project.sh 인터페이스 · 스타터 모듈
  const copy = react.newProject?.kotlin
  const real = kotlin.newProject
  if (copy && real) {
    for (const key of ['script', 'usage'])
      if (copy[key] !== real[key])
        problems.push(
          `newProject.kotlin.${key} differs from kotlin-skeleton newProject.${key}:\n    here:   ${copy[key]}\n    there:  ${real[key]}`,
        )
    for (const key of ['positional', 'flags'])
      if (JSON.stringify(copy[key] ?? []) !== JSON.stringify(real[key] ?? []))
        problems.push(
          `newProject.kotlin.${key} differs from kotlin-skeleton: here [${(copy[key] ?? []).join(' ')}] there [${(real[key] ?? []).join(' ')}]`,
        )
    if (!sameSet(copy.starterModules ?? [], kotlin.starterModules ?? []))
      problems.push(
        `newProject.kotlin.starterModules must be kotlin-skeleton's starterModules:\n    here:  ${list(copy.starterModules ?? [])}\n    there: ${list(kotlin.starterModules ?? [])}`,
      )
  }
  const siblingUsage = kotlin.siblings?.frontend?.usage
  const reactUsage = react.newProject?.react?.usage
  if (siblingUsage && reactUsage && siblingUsage !== reactUsage)
    problems.push(
      `kotlin-skeleton siblings.frontend.usage differs from newProject.react.usage:\n    there: ${siblingUsage}\n    here:  ${reactUsage}`,
    )

  for (const e of react.capabilities.filter((x) => x.backend)) {
    const b = e.backend
    const isApp = e.kind === 'app'
    const where = `capabilities.json ${e.id}.backend`

    // 2. 모듈 이름 — 적은 모듈은 kotlin 에 있다(kotlin 이 짝이라 말한 모듈을 이 항목이 아는지는 6번)
    for (const m of backendModules(b))
      if (!kByModule.has(m))
        problems.push(`${where} names module "${m}", which kotlin-skeleton has no entry for`)
    // 3. 경로 — 앱은 kotlin 앱 항목과 같고, 그 밖에는 짝 모듈의 기본 경로 아래여야 한다
    if (isApp) {
      const k = kById.get(b.app ? `app-${b.app.replace(/^apps\//, '')}` : '')
      if (k && !sameSet(b.basePaths ?? [], k.basePaths ?? []))
        problems.push(
          `${where}.basePaths must be kotlin-skeleton ${k.id}.basePaths:\n    here:  ${list(b.basePaths ?? [])}\n    there: ${list(k.basePaths ?? [])}`,
        )
    } else {
      const theirs = backendModules(b).flatMap((m) => kByModule.get(m)?.basePaths ?? [])
      // 짝 모듈이 없는 항목(예: 공통 클라이언트)은 어느 경로든 부를 수 있다 — 짝이 있을 때만 그 모듈이 여는 경로 아래여야 한다
      for (const path of theirs.length ? (b.basePaths ?? []) : [])
        if (!theirs.some((t) => t === path || t.startsWith(`${path}/`) || path.startsWith(`${t}/`)))
          problems.push(
            `${where}.basePaths has "${path}", which no listed kotlin module serves (kotlin basePaths: ${list(theirs)})`,
          )
    }

    // 4. 앱의 모듈 목록은 gradle 이 실제로 끌어오는 닫힘과 같다
    if (isApp && b.app) {
      const name = b.app.replace(/^apps\//, '')
      if (existsSync(join(kotlinRoot, 'apps', name, 'build.gradle.kts'))) {
        const closure = gradleClosure(kotlinRoot, name)
        if (!sameSet(b.modules ?? [], closure))
          problems.push(
            `${where}.modules must be everything apps/${name} composes (declared dependencies and what they pull in):\n    here:  ${list(b.modules ?? [])}\n    there: ${list(closure)}`,
          )
      }
    }

    // 5. 문서 — 적은 문서는 짝 레포에 있고, 모듈의 문서 페이지는 빠짐없이 적는다
    for (const doc of b.docs ?? [])
      if (!existsSync(join(kotlinRoot, doc)))
        problems.push(`${where}.docs names "${doc}", which kotlin-skeleton does not have`)
    if (!isApp)
      for (const m of [...(b.modules ?? []), ...(b.oneOfModules ?? []).flat()]) {
        const page = `docs/modules/${m}.md`
        if (existsSync(join(kotlinRoot, page)) && !(b.docs ?? []).includes(page))
          problems.push(`${where}.docs is missing ${page} (module ${m})`)
      }
  }

  // 6. kotlin → react: 모듈이 짝이라 말한 항목은 그 항목의 backend 가 그 모듈을 안다
  for (const k of kEntries.filter((x) => x.module && x.frontend)) {
    for (const id of k.frontend.capabilities ?? []) {
      const e = react.capabilities.find((x) => x.id === id)
      if (!e) {
        problems.push(
          `kotlin-skeleton ${k.id}.frontend.capabilities names "${id}", which this catalog does not have`,
        )
        continue
      }
      if (e.kind === 'app' || e.kind === 'script') continue
      if (!backendModules(e.backend).includes(k.module))
        problems.push(
          `kotlin-skeleton says module "${k.module}" pairs with "${id}", but capabilities.json ${id}.backend does not list it (modules / oneOfModules / optionalModules)`,
        )
    }
  }

  // 7. 결정표 — kotlin 결정표가 한 항목에 적은 프런트 명령 조각은 이 카탈로그가 계산한 것과 같다
  for (const d of kotlin.decisions ?? []) {
    const fe = d.frontend
    if (!fe || !fe.capabilities?.length) continue
    if (!fe.capabilities.every((id) => react.capabilities.some((e) => e.id === id))) continue
    const mine = fragmentFor(react, fe.capabilities).react || null
    // 항상 따라오는 패키지(`included: always`, 예: auth)를 적은 것은 군더더기일 뿐 틀린 말이 아니다
    const always = new Set(
      react.capabilities.filter((e) => e.stampFlag?.included === 'always').map((e) => e.id),
    )
    const theirs = flagWithout(fe.flag ?? null, always)
    if (theirs !== mine)
      problems.push(
        `kotlin-skeleton decision "${d.need}": frontend.flag is ${JSON.stringify(fe.flag ?? null)} but capabilities.json computes ${JSON.stringify(mine)} for ${fe.capabilities.join(' + ')}`,
      )
  }
  return problems
}

export const loadKotlin = (root) => readJson(join(root, 'capabilities.json'))
