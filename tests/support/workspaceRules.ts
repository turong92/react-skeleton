import { builtinModules } from 'node:module'
import { posix } from 'node:path'

/*
 * 「패키지는 지울 수 있다 · 복사해 갈 수 있다」를 재는 규칙 — 파일 시스템을 읽지 않는 순수 함수라
 * 가짜 워크스페이스로 규칙마다 테스트된다(workspaceRules.test.ts). 실제 레포에는 workspace.test.ts 가 건다.
 */
export type WorkspaceInput = {
  /** 레포 기준 폴더(`apps/starter`, `packages/auth`) */
  dir: string
  kind: 'app' | 'package'
  packageJson: {
    name: string
    dependencies?: Record<string, string>
    peerDependencies?: Record<string, string>
    devDependencies?: Record<string, string>
  }
  /** 폴더 기준 상대 경로 + 내용 */
  files: Array<{ path: string; text: string }>
}

export type ImportRef = { specifier: string; line: number }

const SCOPE = '@skeleton/'
/** 모든 앱 · 패키지가 루트에서 물려받는 도구 — 선언하지 않아도 된다 */
const TOOLCHAIN = new Set([
  'vitest',
  'vite',
  '@vitejs/plugin-react',
  // 스토리(*.stories.tsx · src/stories/)가 쓰는 Storybook
  'storybook',
  '@storybook/react-vite',
  // 스토리 테스트 실행 설정(vitest.stories.config.ts)
  '@storybook/addon-vitest',
  '@vitest/browser-playwright',
])
const BUILTINS = new Set(builtinModules)
const IMPORT = /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+|@import\s+(?:url\()?)['"]([^'"\n]+)['"]/g

/** 테스트 쪽 파일 — 단위 테스트 · `test/` 폴더 · 스토리(`*.stories.tsx`, 가짜가 사는 `stories/`). 런타임 의존이 아니라 devDependencies 로 충분하다 */
const isTestFile = (path: string) =>
  /\.(test|stories)\.[cm]?[jt]sx?$/.test(path) || /(^|\/)(test|stories)\//.test(path)

function stripComments(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/^\s*\/\/.*$/gm, '')
}

function importsOf(text: string): ImportRef[] {
  const code = stripComments(text)
  return [...code.matchAll(IMPORT)].map((m) => ({
    specifier: m[1],
    line: code.slice(0, m.index).split('\n').length,
  }))
}

/** `@skeleton/…` 로 시작하는 import 만 */
export function skeletonImportsOf(text: string): ImportRef[] {
  return importsOf(text).filter((i) => i.specifier.startsWith(SCOPE))
}

/** `@skeleton/x/sub` → `@skeleton/x`, `react-dom/server` → `react-dom` */
function packageNameOf(specifier: string): string {
  const parts = specifier.split('/')
  return specifier.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0]
}

const isExternal = (specifier: string) =>
  !specifier.startsWith('.') &&
  !specifier.startsWith('/') &&
  !specifier.startsWith('node:') &&
  !BUILTINS.has(packageNameOf(specifier)) &&
  !specifier.startsWith(SCOPE)

/** 위반 목록(사람이 읽는 문장). 비어 있으면 모든 앱 · 패키지가 자기 의존만 선언하고 그것만 쓴다 */
export function findProblems(workspaces: WorkspaceInput[]): string[] {
  const problems: string[] = []
  const byName = new Map(workspaces.map((w) => [w.packageJson.name, w]))

  for (const ws of workspaces) {
    const { name, dependencies = {}, peerDependencies = {}, devDependencies = {} } = ws.packageJson
    const sourceUses = new Set<string>()
    const testUses = new Set<string>()

    for (const file of ws.files) {
      const test = isTestFile(file.path)
      for (const { specifier } of importsOf(file.text)) {
        if (specifier.startsWith('.')) {
          const resolved = posix.join(posix.dirname(file.path), specifier)
          if (resolved === '..' || resolved.startsWith('../'))
            problems.push(
              `${name} imports outside its own folder: ${specifier} (${ws.dir}/${file.path})`,
            )
          continue
        }
        if (specifier.startsWith(SCOPE)) {
          if (/^@skeleton\/[^/]+\/src(\/|$)/.test(specifier))
            problems.push(
              `${name} has a deep import ${specifier} (${ws.dir}/${file.path}) — use the package barrel`,
            )
          const used = packageNameOf(specifier)
          if (used !== name) (test ? testUses : sourceUses).add(used)
          continue
        }
        if (!isExternal(specifier)) continue
        const used = packageNameOf(specifier)
        if (TOOLCHAIN.has(used) || used === name) continue
        const declared = test
          ? { ...dependencies, ...peerDependencies, ...devDependencies }
          : { ...dependencies, ...peerDependencies }
        if (!(used in declared))
          problems.push(`${name} imports ${used} but does not declare it (${ws.dir}/${file.path})`)
      }
      if (ws.kind === 'package' && !test && /\bimport\.meta\.env\b/.test(stripComments(file.text)))
        problems.push(
          `${name} reads import.meta.env (${ws.dir}/${file.path}) — apps do the env wiring`,
        )
    }

    const declaredSkeleton = (record: Record<string, string>) =>
      Object.keys(record).filter((dep) => dep.startsWith(SCOPE))
    for (const dep of sourceUses)
      if (!(dep in dependencies))
        problems.push(`${name} imports ${dep} but does not declare it in dependencies`)
    for (const dep of testUses)
      if (!(dep in dependencies) && !(dep in devDependencies) && !sourceUses.has(dep))
        problems.push(
          `${name} imports ${dep} but does not declare it (tests: dependencies or devDependencies)`,
        )
    for (const dep of declaredSkeleton(dependencies))
      if (!sourceUses.has(dep))
        problems.push(`${name} declares ${dep} but never imports it in source`)

    for (const record of [dependencies, devDependencies]) {
      for (const [dep, range] of Object.entries(record)) {
        const target = byName.get(dep)
        if (target?.kind === 'app')
          problems.push(`${name} depends on the app ${dep} — apps are copied, never depended on`)
        if (dep.startsWith(SCOPE)) {
          if (range !== 'workspace:*')
            problems.push(`${name}: ${dep} must be "workspace:*" (found "${range}")`)
          if (!target) problems.push(`${name}: ${dep} is not a package in this workspace`)
        }
      }
    }
  }

  problems.push(...cycles(workspaces))
  return problems
}

function cycles(workspaces: WorkspaceInput[]): string[] {
  const graph = new Map(
    workspaces.map((w) => [
      w.packageJson.name,
      Object.keys(w.packageJson.dependencies ?? {}).filter((dep) => dep.startsWith(SCOPE)),
    ]),
  )
  const found: string[] = []
  const visiting: string[] = []
  const done = new Set<string>()
  const visit = (name: string) => {
    if (done.has(name)) return
    const at = visiting.indexOf(name)
    if (at >= 0) {
      found.push(`dependency cycle: ${[...visiting.slice(at), name].join(' → ')}`)
      return
    }
    visiting.push(name)
    for (const next of graph.get(name) ?? []) visit(next)
    visiting.pop()
    done.add(name)
  }
  for (const name of graph.keys()) visit(name)
  return found
}
