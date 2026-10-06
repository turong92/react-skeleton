// 스켈레톤 전용 가드 — 카탈로그가 말하는 new-project.sh 의 동작이 진짜 스크립트가 하는 일과 같은가(stamp.mjs plan 이 정답),
// 결정표 · 레시피의 명령이 카탈로그에서 계산한 것과 같은가. 찍힌 프로젝트에는 new-project.sh 가 없어 이 파일도 가지 않는다(stamp.mjs 가 뗀다).
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { fragmentFor } from './fragment.mjs'

const STAMP = 'scripts/new-project.d/stamp.mjs'
const RECIPE = 'docs/new-project-recipe.md'
const PLAN_FLAGS = ['--ssr', '--with-sample', '--with-workbench']
const cache = new Map()

/** stamp.mjs plan 이 남기는 패키지(폴더 이름들, 정렬). 모르는 패키지면 던진다 */
export function planPackages(
  root,
  { requested = [], workbench = false, ssr = false, sample = false } = {},
) {
  const key = `${root}|${requested}|${workbench}|${ssr}|${sample}`
  if (cache.has(key)) return cache.get(key)
  const r = spawnSync(
    process.execPath,
    [
      join(root, STAMP),
      'plan',
      root,
      workbench ? '1' : '0',
      requested.join(','),
      ssr ? '1' : '0',
      sample ? '1' : '0',
    ],
    { encoding: 'utf8' },
  )
  if (r.status !== 0) throw new Error((r.stderr || r.stdout).trim())
  const keep = r.stdout
    .split('\n')
    .filter((l) => l.startsWith('keep '))
    .map((l) => l.slice(5))
    .sort()
  cache.set(key, keep)
  return keep
}

/** `bash new-project.sh --help` 가 문서화한 옵션들 */
export function acceptedOptions(root) {
  const key = `options|${root}`
  if (!cache.has(key)) {
    const r = spawnSync('bash', [join(root, 'scripts/new-project.sh'), '--help'], {
      encoding: 'utf8',
    })
    cache.set(key, new Set(r.stdout.match(/--[a-z][a-z-]*/g) ?? []))
  }
  return cache.get(key)
}

const flagPlan = (root, flag) =>
  planPackages(root, {
    ssr: flag === '--ssr',
    sample: flag === '--with-sample',
    workbench: flag === '--with-workbench',
  })
const same = (a, b) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort())
const dirOf = (e) => e.path.split('/').pop()

/** 문자열 `--packages a,b --ssr --scope @x` → plan 인자 + 옵션 이름들 */
function parseFlags(text) {
  const tokens = text.split(/\s+/).filter(Boolean)
  const out = { requested: [], ssr: false, sample: false, workbench: false, options: [] }
  for (let i = 0; i < tokens.length; i += 1) {
    const t = tokens[i]
    if (!t.startsWith('--')) continue
    out.options.push(t)
    if (t === '--packages') out.requested = (tokens[i + 1] ?? '').split(',').filter(Boolean)
    if (t === '--ssr') out.ssr = true
    if (t === '--with-sample') out.sample = true
    if (t === '--with-workbench') out.workbench = true
  }
  return out
}

export function checkStampFlags(catalog, root) {
  const problems = []
  const options = acceptedOptions(root)
  let baseline
  try {
    baseline = planPackages(root)
  } catch (e) {
    return [`scripts/new-project.sh baseline plan failed: ${e.message}`]
  }
  for (const e of catalog.capabilities) {
    const at = `capabilities.json: ${e.id}.stampFlag`
    const sf = e.stampFlag
    if (sf.included === 'never') continue
    const parsed = parseFlags([sf.flag, sf.optOut].filter(Boolean).join(' '))
    for (const opt of parsed.options)
      if (!options.has(opt))
        problems.push(
          `${at} uses ${opt}, which scripts/new-project.sh does not accept (accepted: ${[...options].join(' ')})`,
        )
    if (e.kind === 'pattern') {
      const owner = catalog.capabilities.find(
        (x) => x.kind === 'package' && x.package === e.package,
      )
      if (owner && JSON.stringify(owner.stampFlag) !== JSON.stringify(sf))
        problems.push(
          `${at} must be the same as its package ${owner.id}'s (a pattern travels with its package): ${JSON.stringify(owner.stampFlag)}`,
        )
      continue
    }
    if (e.kind === 'package') {
      const dir = dirOf(e)
      if (sf.included === 'always') {
        if (!baseline.includes(dir))
          problems.push(
            `${at}.included is "always" but ${dir} is not in the default stamp (${baseline.join(', ')}) — use "flag" with --packages ${dir}`,
          )
        continue
      }
      if (parsed.requested.length) {
        try {
          planPackages(root, { requested: parsed.requested })
        } catch (err) {
          problems.push(
            `${at} ${JSON.stringify(sf.flag)}: ${err.message.split('\n')[0]} (entry ${e.id}) — new-project.sh does not know that package`,
          )
          continue
        }
      }
      if (sf.included !== 'flag' || sf.flag !== `--packages ${dir}`) {
        problems.push(
          `${at} is ${JSON.stringify(sf.flag)} (${sf.included}) but must be {"flag":"--packages ${dir}","included":"flag"} (or included "always" when it is in the default stamp)`,
        )
        continue
      }
      if (baseline.includes(dir))
        problems.push(
          `${at}.included is "flag" but ${dir} is already in the default stamp — use "always"`,
        )
      let closure
      try {
        closure = planPackages(root, { requested: [dir] })
      } catch (err) {
        problems.push(`${at}: ${err.message.split('\n')[0]} (entry ${e.id})`)
        continue
      }
      const auto = closure.filter((p) => p !== dir)
      if (!same(auto, sf.autoIncludes ?? []))
        problems.push(
          `${at}.autoIncludes is ${JSON.stringify(sf.autoIncludes ?? [])} but new-project.sh closes --packages ${dir} to ${JSON.stringify(closure)} (everything it brings besides ${dir}) — set autoIncludes to ${JSON.stringify(auto)}`,
        )
      const via = PLAN_FLAGS.filter((f) => flagPlan(root, f).includes(dir))
      if (!same(via, sf.alsoVia ?? []))
        problems.push(
          `${at}.alsoVia is ${JSON.stringify(sf.alsoVia ?? [])} but ${dir} also comes with ${JSON.stringify(via)} — set alsoVia to that`,
        )
      continue
    }
    if (e.kind === 'app' && sf.included === 'flag' && PLAN_FLAGS.includes(sf.flag)) {
      const auto = flagPlan(root, sf.flag).filter((p) => !baseline.includes(p))
      if (!same(auto, sf.autoIncludes ?? []))
        problems.push(
          `${at}.autoIncludes is ${JSON.stringify(sf.autoIncludes ?? [])} but ${sf.flag} brings ${JSON.stringify(auto)} — set autoIncludes to that`,
        )
    }
  }
  return problems
}

export function checkDecisions(catalog, root) {
  const problems = []
  const ids = new Set(catalog.capabilities.map((e) => e.id))
  const verify = (where, capabilities, extra = []) => {
    const missing = capabilities.filter((id) => !ids.has(id))
    if (missing.length)
      return problems.push(
        `capabilities.json: ${where} names unknown capability id(s): ${missing.join(', ')}`,
      )
    const fragment = fragmentFor(catalog, capabilities, extra)
    const parsed = parseFlags(fragment.react)
    const options = acceptedOptions(root)
    for (const opt of parsed.options)
      if (!options.has(opt))
        problems.push(
          `capabilities.json: ${where} computes ${opt}, which scripts/new-project.sh does not accept`,
        )
    try {
      const kept = planPackages(root, parsed)
      for (const id of capabilities) {
        const e = catalog.capabilities.find((x) => x.id === id)
        if (e.kind === 'package' && !kept.includes(dirOf(e)))
          problems.push(`capabilities.json: ${where}: "${fragment.react}" does not give ${id}`)
      }
    } catch (err) {
      problems.push(
        `capabilities.json: ${where}: new-project.sh rejects "${fragment.react}": ${err.message.split('\n')[0]}`,
      )
    }
  }
  for (const [i, d] of (catalog.decisions ?? []).entries())
    verify(`decisions[${i}] ("${d.need}")`, d.capabilities)
  for (const ex of catalog.examples ?? [])
    verify(`examples "${ex.id}"`, ex.capabilities, ex.extraFlags)
  return problems
}

// ------------------------------------------------------------------------------------------------ 레시피
const FENCE = /```[a-z]*\n([\s\S]*?)```/
function commandAfter(md, marker) {
  const at = md.indexOf(marker)
  if (at < 0) return null
  const block = md.slice(at + marker.length).match(FENCE)
  return (
    block?.[1]
      .split('\n')
      .map((l) => l.trim())
      .find((l) => l.startsWith('scripts/new-project.sh')) ?? null
  )
}

/** 레시피에 적힌 예제 명령들 — --full 스탬프 테스트가 그대로 찍어 본다 */
export function recipeCommands(root) {
  const path = join(root, RECIPE)
  if (!existsSync(path)) return []
  const md = readFileSync(path, 'utf8')
  return [...md.matchAll(/<!-- react-stamp: ([a-z0-9-]+) -->/g)].flatMap((m) => {
    const line = commandAfter(md, m[0])
    if (!line) return []
    const [, , , ...rest] = line.split(/\s+/)
    return [
      {
        id: m[1],
        reactLine: line,
        reactArgs: rest,
        kotlinLine: commandAfter(md, `<!-- kotlin-stamp: ${m[1]} -->`),
      },
    ]
  })
}

/**
 * kotlin `--modules a,b` 에서 스타터에 이미 들어 있는 모듈을 뺀다 — 스타터 모듈을 목록에 적어도 받아 주는 군더더기일 뿐이라(kotlin 의 예제 명령이 그렇게 적는다)
 * 레시피가 그 줄을 그대로 옮겨도 틀린 것이 아니다. 필요한 모듈이 **빠지면** 여전히 어긋난다.
 */
function withoutStarterModules(flags, starter) {
  return flags
    .replace(/--modules (\S+)/, (_, list) => {
      const kept = list.split(',').filter((m) => !starter.has(m))
      return kept.length ? `--modules ${kept.join(',')}` : ''
    })
    .replace(/\s+/g, ' ')
    .trim()
}

export function checkRecipe(catalog, root) {
  const problems = []
  const path = join(root, RECIPE)
  if (!existsSync(path))
    return [
      `${RECIPE} is missing — write the setup recipe (one worked example per capabilities.json "examples" entry)`,
    ]
  const md = readFileSync(path, 'utf8')
  for (const ex of catalog.examples ?? []) {
    const f = fragmentFor(catalog, ex.capabilities, ex.extraFlags, ex.kotlinExtraFlags)
    const react = commandAfter(md, `<!-- react-stamp: ${ex.id} -->`)
    const expectedReact = `scripts/new-project.sh <target-dir> <name> ${f.react}`.trim()
    if (!react)
      problems.push(
        `${RECIPE}: example "${ex.id}" has no <!-- react-stamp: ${ex.id} --> code block with a scripts/new-project.sh line — expected: ${expectedReact}`,
      )
    else {
      const actual = react.split(/\s+/).slice(3).join(' ')
      if (actual !== f.react)
        problems.push(
          `${RECIPE}: example "${ex.id}" react command has "${actual}" but capabilities.json computes: ${expectedReact}`,
        )
    }
    const kotlin = commandAfter(md, `<!-- kotlin-stamp: ${ex.id} -->`)
    const expectedKotlin =
      `scripts/new-project.sh <target-dir> <root-package> <config-prefix> <ClassPrefix> ${f.kotlin}`.trim()
    if (!kotlin)
      problems.push(
        `${RECIPE}: example "${ex.id}" has no <!-- kotlin-stamp: ${ex.id} --> code block — expected: ${expectedKotlin}`,
      )
    else {
      const parts = kotlin.split(/\s+/).slice(1)
      const positional = parts.findIndex((p) => p.startsWith('--'))
      const flags = (positional < 0 ? [] : parts.slice(positional)).join(' ')
      if ((positional < 0 ? parts.length : positional) !== 4)
        problems.push(
          `${RECIPE}: example "${ex.id}" kotlin command must have 4 positional arguments (<target-dir> <root-package> <config-prefix> <ClassPrefix>)`,
        )
      const starter = new Set(catalog.newProject?.kotlin?.starterModules ?? [])
      if (withoutStarterModules(flags, starter) !== withoutStarterModules(f.kotlin, starter))
        problems.push(
          `${RECIPE}: example "${ex.id}" kotlin command has "${flags}" but capabilities.json computes: ${expectedKotlin}`,
        )
    }
  }
  return problems
}

/** kotlin-skeleton 이 옆에 있을 때만: backend.* 의 모듈 이름이 그쪽 색인에 있는가 */
export function checkKotlinNames(catalog, readmePath) {
  const known = new Set(
    [...readFileSync(readmePath, 'utf8').matchAll(/^\| `([a-z0-9-]+)` \|/gm)].map((m) => m[1]),
  )
  const problems = []
  for (const e of catalog.capabilities.filter((x) => x.backend))
    for (const m of [
      ...e.backend.modules,
      ...(e.backend.optionalModules ?? []),
      ...(e.backend.oneOfModules ?? []).flat(),
    ])
      if (!known.has(m))
        problems.push(
          `capabilities.json: ${e.id}.backend names module "${m}", which kotlin-skeleton docs/modules/README.md does not list`,
        )
  return problems
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href &&
  process.argv[2] === 'recipe-args'
) {
  const root = process.argv[3] ?? process.cwd()
  for (const c of recipeCommands(root)) console.log(`${c.id}\t${c.reactArgs.join(' ')}`)
}
